const mqtt = require('mqtt');
const config = require('config');
const fs = require('fs');
const EventEmitter = require('events');
const {logger} = require('./common');

// load configs
const gatewayId = config.get('mqtt.gatewayId');
const host = config.get('mqtt.host');
const port = config.get('mqtt.port');
const username = config.get('mqtt.username'); 
const password = config.get('mqtt.password'); 

class MqttClient extends EventEmitter {

    constructor() {
        super();

        var options = {
            host: host,
            port: port,
            protocol: 'mqtt', 
            username: username, 
            password: password, 
        };

        logger.log('debug', `[MQTT] Connecting to ${host}:${port} with username ${username}`);
        this.client = mqtt.connect(options);

        this.client.on('connect', () => {
            this._onConnect();
        });

        this.client.on('error', (error) => {
            logger.log('error', `[MQTT] Connection error: ${error.message}`);
        });
    }

    _onConnect() {
        logger.log('info', 'Client connected');

        this.client.on('message', (msg) => this._onMessage(msg));

        this.client.on('error', function (err) {
            logger.log('error', err);
        });
    };

    _onMessage(msg) {
        logger.log('info', `Received message ${msg}`);
    }

    publishMessage(messageJson) {
        const keys = Object.keys(messageJson);
        if (keys.length > 0 && messageJson[keys[0]] && typeof messageJson[keys[0]].value !== 'undefined') {
            logger.log('debug', '[MQTT] Publishing device values for Home Assistant');
            keys.forEach(key => { // key is like "2_202"
                const bacnetObjectType = key.split('_')[0]; // e.g., "2"
                let haComponentType = 'sensor'; 

                // Using string comparison for object types as in the user's snippet
                if (bacnetObjectType === '0' || bacnetObjectType === '2' || bacnetObjectType === '139' || bacnetObjectType === '140' || bacnetObjectType === '141' || bacnetObjectType === '143') {
                    haComponentType = 'sensor';
                } else if (bacnetObjectType === '3' || bacnetObjectType === '5' || bacnetObjectType === '21') {
                    haComponentType = 'binary_sensor';
                } else if (bacnetObjectType === '13' || bacnetObjectType === '19') { 
                    haComponentType = 'sensor'; 
                } else {
                    haComponentType = 'sensor';
                    logger.log('warn', `[MQTT] Unknown BACnet object type ${bacnetObjectType} for key ${key}, defaulting to HA type 'sensor'.`);
                }

                const topic = `homeassistant/${haComponentType}/${gatewayId}/${key}/state`;
                const message = JSON.stringify(messageJson[key].value);

                logger.log('debug', `[MQTT] Publishing to ${topic}: ${message}`);
                this.client.publish(topic, message, { retain: true }); 
            });
        } else if (messageJson && typeof messageJson.deviceId !== 'undefined' && typeof messageJson.address !== 'undefined') {
            logger.log('info', `[MQTT] Publishing device found event for ${messageJson.address}`);
            // Example topic: bacnet-gateway/YOUR_GATEWAY_ID/device_found/DEVICE_ID
            const topic = `bacnet-gateway/${gatewayId}/device_found/${messageJson.deviceId}`;
            const message = JSON.stringify(messageJson);
            logger.log('debug', `[MQTT] Publishing to ${topic}: ${message}`);
            this.client.publish(topic, message, { retain: true });
        } else {
            if (keys.length === 0 && JSON.stringify(messageJson) === '{}') {
                logger.log('warn', '[MQTT] Received empty object to publish. Skipping.');
                return; 
            }
            logger.log('warn', `[MQTT] Unknown message structure. Publishing to default/error topic: ${JSON.stringify(messageJson)}`);
            const topic = `bacnet-gateway/${gatewayId}/unknown_data`;
            const message = JSON.stringify(messageJson);
            logger.log('debug', `[MQTT] Publishing to ${topic}: ${message}`);
            this.client.publish(topic, message);
        }
    }
}

module.exports = {MqttClient};
