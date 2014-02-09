//
// Deploy/server.js - This is the heart of the server. Most all the work gets done in here.
//
var PORT = process.env.OPENSHIFT_NODEJS_PORT || 8080;
var IPADDRESS = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
var MONGOIP = process.env.OPENSHIFT_MONGODB_DB_HOST || '127.0.0.1';
var MONGOPORT = process.env.OPENSHIFT_MONGODB_DB_PORT || 27017;

var mongoose = require ("mongoose"); 
var restify = require ("restify");

// Schemas
var feedHistorySchema = new mongoose.Schema({
	feedid: { type: String },
	lastDispatch: { type: Number, min: 0 },
    	lastUpdate: { type: Number, min: 0 },
	lastUpdatedBy: { type: String },
	lastSuccess: { type: Number, min: 0 },
});

var feedSchema = new mongoose.Schema({
	internalID: { type: String },
	title: { type: String, trim: true },
    	url: { type: String, trim: true },
    	feedid: { type: Number, min: 0 },
	category: { type: Number, min: 0 },
	type: { type: Number, min: 0 },    
	image: { type: String, trim: true },    
	timeOffset: { type: Number, min: 0},    
	who: { type: Number, min: 0 },    
	personal: { type: Number, min: 0 },    
	dateAdded: { type: Number, min: 0 },    

	lastDispatch: { type: Number, min: 0 },
    	lastUpdate: { type: Number, min: 0 },
	lastUpdatedBy: { type: String },
	lastSuccess: { type: Number, min: 0 },
});

var feedDataSchema = new mongoose.Schema({
	feedid: { type: String },
    	title: { type: String },
    	url: { type: String },
    	image: { type: String },
    	pubdateseconds: { type: Number, min: 0 },
    	timeaggregated: { type: Number, min: 0 },
    	title: { type: String },
    	description: { type: String },
    	guid: { type: String },
    	uuid: { type: String },
    	author: { type: String },
	category: { type: String },
});

var feedSubscriptionSchema = new mongoose.Schema({
	uid: { type: Number, min: 0},
    	feeid: { type: Number, min: 0}
});

var feedUserSchema = new mongoose.Schema({
	uid: { type: Number, min: 0},
	lastLogin: { type: Number, min: 0},
//	access: { type: Number, min: 0},	//Not sure this is good to have here... security wise. or if it matters.
	timezone: { type: Number, min: 0},
	SPP: { type: Number, min: 0},
	lastDisplay: { type: Number, min: 0},
	GPS: { type: String},
});

// Get environment currently running under
var env = "live";

var feeds = mongoose.model('Feeds', feedSchema);
var history = mongoose.model('History', feedHistorySchema);
var feedData = mongoose.model('FeedData', feedDataSchema);
var feedSubs = mongoose.model('FeedSubscriptions', feedSubscriptionSchema);
var feedUsers = mongoose.model('FeedUsers', feedUserSchema);

function respond(req, res, next) {
	//console.log(req.params);	
/*	if (req.params.server === undefined) {
	    return next(new restify.InvalidArgumentError('Server must be supplied'))
  	}*/
	var options = {upsert: true};

	// Not sure if I have all this data or not for this call.
	var feedData = {
		title: req.params.title,
    		url: req.params.url,
    		feedid: req.params.feedid,
		category: req.params.category,
		type: req.params.type,    
		image: req.params.image,    
		timeOffset: req.params.timeOffset,    
		who: req.params.who,    
		personal: req.params.personal,    
		dateAdded: req.params.dateAdded,    
	};

	// Saving it to the database.
	feeds.findOneAndUpdate({ feedid: req.params.feedid, url: req.params.url }, feedData, options, function (err) {
		if (err) {console.log ('Error on save for '+req.params+" Error: "+err)} else {
  			res.send('OK');
		}
	});
}

function findoldest(server) {
	return deployment.aggregate({key: {"lastUpdate":-1},reduce: function (curr,result) {result.total++; if(curr.datestamp<result.datestamp) { result.datestamp=curr.datestamp;} }, initial: {datestamp: Date.now()} });
}

function feedList(req, res, next) {
	feeds.find({},{feedid: 1, title: 1},function(err,data) {
		if (err) { res.send(err); } else { res.send(data); } 
	});
}

function feedInfo(req, res, next) {
	var lasttwelve=Date.now()-43200000000;
	feedData.find({ timeaggregated: { $gt: lasttwelve }, feedid: req.params.feedid }, null, function(err,data) {
		if (err) { res.send(err); } else { res.send(data) }
	});
}

function currentStories(req, res, next) {
        // > db.feeddatas.find({ timeaggregated: { $gt: 1391456885107000 }}).count();  => 24
	//Date.now() == 1391369704,609898  1391456086000000-7200000
	//Twelve Hours: var lasttwelve=Date.now()-43200000;
	//Six Hours: var lasttwelve=Date.now()-21600000;
	//      var lasttwelve=Date.now()-7200000;
	var lasttwelve=(Date.now()-2880000)*1000;
	feedData.find({ timeaggregated: { $gt: lasttwelve } }, { feedid:1, image:1, category:1, title: 1, uuid:1, pubdateseconds: 1}, { sort: { timeaggregated: -1}},function(err,data) {
		if (err) { res.send(err); } else { res.send(data) }
	});
}
// We need to rewrite dispatch so that it looks at the updateData instead of at the feed listings. 
// The catch with this is that a new updateData record won't be created because one doesn't exist... so we need to create them,
// or we need to store the last update time and last dispatch time in the feeds table in the first place. 
function dispatch(req, res, next) {
	feeds.findOne({ "lastDispatch" : { "$exists" : false } },function(err,data) {
		if (data!=null) {
			data.lastDispatch=0;
			data.save(function (err) { if (err) { res.send(err); } });
		}	
	});

	//This can't have feedid come in as the server doesn't know what ID it'll get
	feeds.findOne({ }, null, { sort: { lastDispatch: 1 } }, function(err,data) { //, null, { sort: { lastUpdate: -1 } }, function(err,data) {
		if (err) { res.send(err); } else { 
			var options = {upsert: true};
			var updateData = {
				lastDispatch: Date.now(),
//			    	lastUpdate: Date.now(),
				lastUpdatedBy: req.params.server,
//				lastSuccess: { type: Number, min: 0 },
			};
			var lasttwelve=Date.now()-43200000000;
			//console.log(lasttwelve);
			feedData.find({ timeaggregated: { $gt: lasttwelve }, feedid: data.feedid }, { uuid: 1 }, function (err,udata) {
				//console.log(udata);
				var d = { 
					uuids: udata,
					info: data,
				};
				res.send(d);
     			});
			feeds.findOneAndUpdate({ feedid: data.feedid }, updateData, options, function (err) { if (err) { res.send(err); } });
		}
	});
}

//// Feed Story Stuff ////////////////////////////////////////////////////////////////////////////////

function getStoryData(req, res, next) { 
		feedData.findOne({ uuid: req.params.uuid }, function (err,data) { if (err) { res.send(err); } else { res.send(data); } });
}

function addStoryData(req, res, next) {
	//console.log(req.params);	
/*	if (req.params.server === undefined) {
	    return next(new restify.InvalidArgumentError('Server must be supplied'))
  	}*/
	var options = {upsert: true};

	var storyData = {
    		feedid: req.params.feedid,
		title: req.params.title,
    		url: req.params.url,
		image: req.params.image,    
		pubdateseconds: req.params.pubdateseconds,    
		timeaggregated: req.params.timeaggregated,    
		category: req.params.category,
		description: req.params.description,
		author: req.params.author,
		uuid: req.params.uuid,    
		guid: req.params.guid,    
	};

	// Saving it to the database.
	feedData.findOneAndUpdate({ feedid: req.params.feedid, uuid: req.params.uuid }, storyData, options, function (err,data) {
		if (err) {console.log ('Error on save for '+req.params+" Error: "+err)} else {
			var updateData = {
			    	lastUpdate: Date.now(),
				lastSuccess: Date.now(),
			};
			res.send(data);
			feeds.findOneAndUpdate({ feedid: data.feedid }, updateData, options, function (err) { if (err) { res.send(err); } });
	
			res.send('OK');
		}
	});
}

function findURL(req, res, next) {
	feedData.findOne({ uuid: req.params.uuid }, { url: 1}, function (err,data) { 
		if (err) { console.log('Error Looking Up uuid: '+req.params.uuid); } else { res.send(data); } });
}

///// Feed Subscription Stuff ////////////////////////////////////////////////////////////////////////
function addFeedSubscription(req, res, next) {
	var options = {upsert: true};
	var sub = { feedid: req.params.feedid, uid: req.params.uid };
	console.log(sub);
	feedSubs.findOneAndUpdate({uid: req.params.uid, feedid: req.params.feedid}, sub, options, function(err,data) {
		if (err) { console.log ('Error saving feed subscription '+err); } else { res.send("OK"); }
	});
}

function getFeedSubscriptions(req, res, next) {
	feedSubs.find({},null,function (err,data) { if (err) { res.send(err); } else { res.send(data); }});	
}

function getFeedSubscriptionsPerUser(req, res, next) {
	feedSubs.find({uid: req.params.uid},null,function (err,data) { if (err) { res.send(err); } else { res.send(data); }});	
}

///// User Info Stuff ////////////////////////////////////////////////////////////////////////////////
function addFeedUser(req, res, next) {
	var options = {upsert: true};
	var user = { uid: req.params.uid, lastLogin: req.params.lastLogin, timezone: req.params.timezone, SPP: req.params.spp, lastDisplay: req.params.ldisplay, GPS: req.params.gps };
	console.log(user);
	feedUsers.findOneAndUpdate({uid: req.params.uid }, sub, options, function(err,data) {
		if (err) { console.log ('Error saving feed subscription '+err); } else { res.send("OK"); }
	});
}

function getFeedUser(req, res, next) {
	feedUsers.find({uid : req.params.uid },null,function (err,data) { if (err) { res.send(err); } else { res.send(data); }});	
}


var server = restify.createServer();
server.use(restify.bodyParser());
server.get('/hello/:name',function(req, res, next) { res.send("Hey, "+req.params.name+". We're in the pipe, 5 by 5"); });

server.post('/feed/:feedid',respond);
server.get('/feed/:feedid',feedInfo);
server.post('/story/:uuid',addStoryData);
server.get('/story/:uuid',getStoryData);
server.get('/dispatch/:server',dispatch);

server.get('/feedlist/',feedList);
server.get('/feedlatest/:feedid',feedInfo);
server.get('/current/',currentStories);
server.get('/short/:uuid',findURL);

server.post('/setfs/',addFeedSubscription);
server.get('/getfs/',getFeedSubscriptions);
server.get('/getfs/:uid',getFeedSubscriptionsPerUser);

// This should really have auth around it. Not that it stores passwords.
server.post('/setui/:uid',addFeedUser);
server.get('/getui/:uid',getFeedUser);

// Here we find an appropriate database to connect to, defaulting to
// localhost if we don't find one.
var uristring = 'mongodb://inator:jiHU*gy@'+MONGOIP+':'+MONGOPORT+'/feedinator';

// Makes connection asynchronously.  Mongoose will queue up database
// operations and release them when the connection is complete.
mongoose.connect(uristring, function (err, res) {
  	if (err) {
  		console.log ('ERROR connecting to: ' + uristring + '. ' + err);
  	} else {
  		console.log ('Succeeded connected to: ' + uristring);

// Deployment Schema setup, Mongo connected, time to start listening

		server.listen(PORT, IPADDRESS, function() {
		  	console.log('%s listening at %s', server.name, server.url);
		});

	}
});
