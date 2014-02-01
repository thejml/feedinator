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

// Get environment currently running under
var env = "live";

var feeds = mongoose.model('Feeds', feedSchema);
var history = mongoose.model('History', feedHistorySchema);
var feedData = mongoose.model('FeedData', feedDataSchema);

function respond(req, res, next) {
	console.log(req.params);	
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

function feedInfo(req, res, next) {
	feeds.findOne({ feedid: req.params.feedid }, function(err,data) {
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
			console.log(data);
			var updateData = {
				lastDispatch: Date.now(),
//			    	lastUpdate: Date.now(),
				lastUpdatedBy: req.params.server,
//				lastSuccess: { type: Number, min: 0 },
			};
			var lasttwelve= Date.now()-(3600*12*1000000);
			feedData.find({ feedid: data.feedid }, { uuid: 1 }, { timeaggregated: { $gt: lasttwelve } }, function (err,udata) {
				data.uuids=udata;
			}
			res.send(data);
			feeds.findOneAndUpdate({ feedid: data.feedid }, updateData, options, function (err) { if (err) { res.send(err); } });
		}
	});
}

function getStoryData(req, res, next) { 
		feedData.findOne({ uuid: req.params.uuid }, function (err,data) { if (err) { res.send(err); } else { res.send(data); } });
}

function addStoryData(req, res, next) {
	console.log(req.params);	
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



var server = restify.createServer();
server.use(restify.bodyParser());
server.get('/hello/:name',function(req, res, next) { res.send("Hey, "+req.params.name+". We're in the pipe, 5 by 5"); });

server.post('/feed/:feedid',respond);
server.get('/feed/:feedid',feedInfo);
server.post('/story/:uuid',addStoryData);
server.get('/story/:uuid',getStoryData);
server.get('/dispatch/:server',dispatch);

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
