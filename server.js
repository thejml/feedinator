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
	lastDispatch: { type: Number, min: 0 },
    	lastUpdate: { type: Number, min: 0 },
	lastUpdatedBy: { type: String },
	lastSuccess: { type: Number, min: 0 },
});

var feedSchema = new mongoose.Schema({
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
});

// Get environment currently running under
var env = "live";

var feeds = mongoose.model('Feeds', feedSchema);
var history = mongoose.model('History', feedHistorySchema);

function respond(req, res, next) {
//	console.log(req.params);	
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
		timeOffset: req.params.offset,    
		who: req.params.who,    
		personal: req.params.personal,    
		dateAdded: req.params.dateadded,    
	};

	// Saving it to the database.
	feeds.findOneAndUpdate({ feedid: req.params.feedid, url: req.params.url }, feedData, options, function (err) {
		if (err) {console.log ('Error on save for '+req.params+" Error: "+err)} else {}
	});
  	res.send('OK');
}

function findoldest(server) {
	return deployment.aggregate({key: {"lastUpdate":-1},reduce: function (curr,result) {result.total++; if(curr.datestamp<result.datestamp) { result.datestamp=curr.datestamp;} }, initial: {datestamp: Date.now()} });
}

function listLatestPerServer(req, res, next) {
//	console.log("Quering..."+req.params.name);
	deployment.find({ server: req.params.name }, null, { sort: { datestamp: -1 } },function(err, deploys) { res.send(deploys); });
}

function feedInfo(req, res, next) {
	feeds.findOne({ feedid: req.params.feedid }, function(err,data) {
		if (err) { res.send(err); } else { res.send(data) }
	});
}

function dispatch(req, res, next) {
	//This can't have feedid come in as the server doesn't know what ID it'll get
	feeds.findOne({ feedid: req.params.feedid }, function(err,data) {
		if (err) { res.send(err); } else { res.send(data) }
	});
	var options = {upsert: true};

	var updateData = {
		lastDispatch: Date.now(),
	    	lastUpdate: Date.now(),
		lastUpdatedBy: req.params.server,
//		lastSuccess: { type: Number, min: 0 },
	};

	feedHistory.findOneAndUpdate({ feedid: req.params.feedid }, updateData, options, function (err) { if (err) { res.send(err); } });
}

/*function listEnvironments(req, res, next) { 
	deployment.aggregate([{ $group: { _id: { environment: "$environment" } } } ], 
		function(err, deploys) { res.send(deploys); });
}

function listServersPerEnvironment(req, res, next) {
	deployment.aggregate([{ $group: { _id: { server: "$server"}, $find: { enviroment: req.params.name } } } ], 
		function(err, deploys) { res.send(deploys); });
}

function listLatestPerEnvironment(req, res, next) {
//	console.log("Quering..."+req.params.name);

	deployment.aggregate([{$match:{"environment":req.params.name}},{$sort:{"datestamp":-1}},{$group:{_id:{server:"$server",codebase:"$codebase"},release:{$first:"$release"},datestamp:{$first:"$datestamp"},location:{$first:"$location"},server:{$first:"$server"},codebase:{$first:"$codebase"}}}], 
//	deployment.find({ environment: req.params.name }, null, { sort: { datestamp: -1, codebase: 1, location: 1, server: -1 }},
//	deployment.aggregate({ environment: req.params.name}).group({ _id : "$server"}).exec(
		function (err, deploys) {
			deploys.forEach(function(deploy) {
				var outgoingDeployment = {
					release: deploy._id.release,
					datestamp: deploy.datestamp,
//					md5: req.params.md5,
					location: deploy.location,
  					codebase: deploy._id.codebase,
					server: deploys.server,
//					success: 1,
					environment: deploys.environment
				};
//				res.send(deploy);
			});
			res.send(deploys);
	});
}

function listHistoryPerEnvironment(req, res, next) {
	deployment.find({ environment: req.params.name }, null, { sort: { datestamp: -1, codebase: 1, location: 1, server: -1 }},function(err, deploys) { res.send(deploys); });
//	deployment.aggregate([{ $group: { _id: { environment: req.params.name },  mostRecent: { $max: "$datestamp" } } } ], 
//		function(err, deploys) { res.send(deploys); });
}



function listLatestForAll(req, res, next) {
// This will group by server and release. It will have multiple server entries because each server will have multiple releases.
	deployment.aggregate([{$project:{server: 1, release: 1, datestamp: 1}}, { $group: { _id: { server: "$server" },  mostRecent: { $max: "$datestamp" } } } ], 
		function(err, deploys) { res.send(deploys); });
}

function pushRelease(req, res, next) {
	console.log(req.params.tostring());
	var options = {upsert: true};

	var pushDeployment = {
		release: req.params.release,
		datestamp: Date.now(),
		location: req.params.location,
  		codebase: req.params.codebase,
		environment: req.params.enviro
	};

	// Saving it to the database.
	pushes.findOneAndUpdate({ release: req.params.release, codebase: req.params.codebase, location: req.params.location, environment: req.params.enviro }, pushDeployment, options, function (err) {
		if (err) {console.log ('Error on save for '+req.params+' Error: '+err)} else { res.send('OK'); }
	});
}

function getCurrent(req, res, next) {

	pushes.find({ environment: req.params.enviro, location: req.params.location, codebase: req.params.codebase }, null, { sort: { datestamp: -1, codebase: 1, location: 1 }},function(err, deploys) { res.send(deploys); });
}
*/

var server = restify.createServer();
server.use(restify.bodyParser());
server.get('/hello/:name',function(req, res, next) { res.send("Hey, "+req.params.name+". We're in the pipe, 5 by 5"); });

server.post('/feed/:feedid',respond);
server.get('/feed/:feedid',feedInfo);
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
