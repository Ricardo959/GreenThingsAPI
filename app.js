
// ---------------- Constantes ----------------

const USERNAME = 'greenthing';
const PASSWORD = 'xyzlmnop';
const DBADDRESS = 'mongodb://localhost:27017';


// ---------------- Bibliotecas ----------------

let express = require('express');
let path = require('path');
let os = require('os');
let mosca = require('mosca');
let mqtt = require('mqtt');
let mongo = require('mongodb').MongoClient;


// ---------------- Inicialização ----------------

console.log("App initializing ...");

let app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));

let IP = 0;
try {
    IP = os.networkInterfaces()['Wi-Fi'][1]['address'];
} catch (err) {
    throw err;
}


// ---------------- MongoDB ----------------

mongo.connect(DBADDRESS, function(err, db) {
    if (err) throw err;
    console.log("Connected to MongoDB on: " + DBADDRESS);
    db.close();
});


// ---------------- Mosca MQTT Broker ----------------

let broker = new mosca.Server({port: 1883, http: {port: 8080}});

broker.on('ready', function(){
    console.log("Mosca server listening on mqtt://%s:%s", IP, 1883);
});

broker.authenticate = function(client, username, password, callback) {
    let authorized = (username && username === USERNAME && password && password.toString() === PASSWORD);
    if (authorized) broker.user = username;
    callback(null, authorized);
};



// ---------------- MQTT Client ----------------

let client = mqtt.connect('mqtt://' + IP, {username: USERNAME, password: PASSWORD});

client.on('connect', function () {
    client.subscribe('/device/new');
    client.subscribe('/device/get');
    client.subscribe('/sensor/value');
    console.log("MQTT client connected\nReady to accept connections ...");
});

client.on('message', function (topic, msg) {
    console.log("Message received: '" + topic + "': " + msg);
    switch (topic) {
        case '/device/new': {
            newDevice(msg);
            break;
        }
        case '/device/get': {
            getDevice(msg);
            break;
        }
        case '/sensor/value': {
            addValue(msg);
            break;
        }
    }
});


// ---------------- Requisições ----------------

/* Entrada para cadastro de um dispositivo:
{
    "mac": "112233445566",
    "sensors": [
        { "type": "h" },
        { "type": "t" } ],
    "actuators": [
        { "type": "v" },
        { "type": "l" } ]
}
*/

function newDevice(msg) {
    try {
        let data = JSON.parse(msg);

        let payload = {};
        if ('mac' in data) payload['mac'] = parseInt(data['mac']);
        payload['sleep_time'] = 60;
        payload['online'] = 1;

        let sensorArray = [];
        if (data.sensors) {
            for (let i = 0; i < data.sensors.length; i++) {
                let sensorPayload = {};
                if ('type' in data.sensors[i]) sensorPayload['type'] = data.sensors[i]['type'];
                sensorPayload['current_value'] = 'null';
                sensorPayload['history'] = [];
                sensorArray.push(sensorPayload);
            }
        }
        payload['sensors'] = sensorArray;

        let actuatorArray = [];
        if (data.actuators) {
            for (let i = 0; i < data.actuators.length; i++) {
                let actuatorPayload = {};
                if ('type' in data.actuators[i]) actuatorPayload['type'] = String(data.actuators[i]['type']);
                actuatorPayload['current_state'] = 'null';
                actuatorPayload['user_state'] = 'null';
                actuatorPayload['activation'] = [];
                actuatorPayload['time_activation'] = [];
                actuatorArray.push(actuatorPayload);
            }
        }
        payload["actuators"] = actuatorArray;

        mongo.connect(DBADDRESS, function(err, db) {
            if (err) {
                console.log("ERROR 41: " + err);
            } else {
                let dbo = db.db('greenhouse');
                dbo.collection('devices').insertOne(payload, function (err, res) {
                    db.close();
                    if (err) {
                        console.log("ERROR 42: " + err);
                    } else {
                        console.log("Device inserted into MongoDB: " + res);
                    }
                });
            }
        });
    } catch (err) {
        console.log("ERROR 40: " + err);
    }
}


/* Entrada para solicitar dados de um dispositivo:
{
    "mac": "112233445566"
}
*/

function getDevice(msg) {
    try {
        let data = JSON.parse(msg);

        let query = {};
        if ('mac' in data) query['mac'] = parseInt(data['mac']);

        mongo.connect(DBADDRESS, function(err, db) {
            if (err) {
                console.log("ERROR 51: " + err);
            } else {
                let dbo = db.db('greenhouse');
                dbo.collection('devices').findOne(query, {'_id': 0, 'sensors.history': 0}, function(err, doc) {
                    db.close();
                    if (err) {
                        console.log("ERROR 52: " + err);
                    } else {
                        let payload = JSON.stringify(doc);
                        client.publish('/device/response', payload, {qos: 2, retain: true}, function(err) {
                            if (err) {
                                console.log("ERROR 53: " + err);
                            } else {
                                console.log("Requested device published");
                            }
                        });
                    }
                });
            }
        });
    } catch (err) {
        console.log("ERROR 50: " + err);
        client.publish('/device/response', 'error', {qos: 2, retain: true});
    }
}


/* Entrada para adicionar valores de sensores ao dispositivo:
{
    "mac": "112233445566",
    "sensors": [
        { "type": "h", "value": 20, "datetime": "2019-01-23T11:22:33.444" },
        { "type": "t", "value": 30, "datetime": "2019-01-23T11:22:33.444" } ]
}
("datetime" é optional) */

function addValue(msg) {
    try {
        let data = JSON.parse(msg);

        let mac;
        if ('mac' in data) mac = parseInt(data['mac']);

        if (data.sensors) {
            mongo.connect(DBADDRESS, function(err, db) {
                if (err) {
                    console.log("ERROR 61: " + err);
                } else {
                    let dbo = db.db('greenhouse');

                    for (let i = 0; i < data.sensors.length; i++) {
                        let value;
                        if ('value' in data.sensors[i]) value = data.sensors[i]['value'];
                        let type;
                        if ('type' in data.sensors[i]) type = data.sensors[i]['type'];

                        let datetime;
                        if(data.sensors[i].datetime) {
                            datetime = new Date(data.sensors[i].datetime);
                        } else {
                            datetime = new Date();
                        }

                        let query = {
                            'mac': mac,
                            'sensors.type': type
                        };

                        let payload = {
                            '$push': {
                                'sensors.$.history': {
                                    'value': value,
                                    'date_time': datetime
                                }
                            }
                        };

                        dbo.collection('devices').updateOne(query, payload, function(err, res) {
                            db.close();
                            if (err) {
                                console.log("ERROR 62: " + err);
                            }
                        });
                    } // end loop

                    console.log(data.sensors.length + " sensor readings have been added to device: " + mac);
                }
            });
        }
    } catch (err) {
        console.log("ERROR 60: " + err);
    }
}

// ---------------- Dashboard ----------------

app.get('/', function (req, res) {
    res.render(__dirname + '/public/views/dashboard.ejs', {ip: IP});
});


// ---------------- Servidor ----------------

let server = app.listen(3000, function () {
    let host = server.address().address;
    let port = server.address().port;

    console.log("Server listening on http://%s:%s", host, port);
});
