const express = require('express');
const config = require('config');
const cors = require('cors');
const { json } = require('body-parser');
const { logger } = require('./common');
const swaggerUi = require('swagger-ui-express'); 
const YAML = require('yamljs'); 
const path = require('path'); 

const port = config.get('httpServer.port');
const openapiDocument = YAML.load(path.join(__dirname, '../openapi.yaml')); 

class Server {

    constructor(bacnetClient) {

        this.bacnetClient = bacnetClient;
        
        this.app = express();        
        this.app.use(json());
        this.app.use(cors());
        this.app.use('/admin', express.static('web'));
        this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument)); 

        // define REST api
        this.app.put('/api/bacnet/scan', this._scanForDevices.bind(this));
        this.app.put('/api/bacnet/:deviceId/objects', this._scanDevice.bind(this));
        this.app.put('/api/bacnet/:deviceId/config', this._configurePolling.bind(this));
        this.app.put('/api/bacnet/write', this._writeProperty.bind(this)); 

        // start server
        this.app.listen(port, () => {
        });
    }

    _scanForDevices(req, res) {
        const devices = [];
        const eventListener = (device) => devices.push(device);
        this.bacnetClient.on('deviceFound', eventListener);
        this.bacnetClient.scanForDevices();
        setTimeout(() => {
            this.bacnetClient.removeListener('deviceFound', eventListener);
            res.send(devices);
        }, 5000);
    }

    _scanDevice(req, res) {
        const device = req.body;
        this.bacnetClient.scanDevice(device).then(deviceObjects => {
            if (req.query.saveConfig === 'true') {
                const config = {
                    'device': device,
                    'polling': {
                        'schedule': "*/15 * * * * *"
                    },
                    'objects': deviceObjects
                }
                this.bacnetClient.saveConfig(config);
                this.bacnetClient.startPolling(config.device, config.objects, config.polling.schedule);
            }
            res.send(deviceObjects);
        });
    }

    _configurePolling(req, res) {
        const config = req.body;
        this.bacnetClient.saveConfig(config);
        this.bacnetClient.startPolling(config.device, config.objects, config.polling.schedule);
        res.send({});
    }

    async _writeProperty(req, res) {
        const {
            deviceId, // This is the key from your device config files (e.g., "114", "baspi1")
            objectType,
            objectInstance,
            propertyId,
            value,
            priority,
            bacnetApplicationTag
        } = req.body;

        if (deviceId === undefined || objectType === undefined || objectInstance === undefined || propertyId === undefined || value === undefined) {
            return res.status(400).send({ status: 'error', message: 'Missing required fields: deviceId, objectType, objectInstance, propertyId, value' });
        }

        const deviceConfig = this.bacnetClient.deviceConfigs.get(deviceId.toString());

        if (!deviceConfig || !deviceConfig.device || !deviceConfig.device.address) {
            return res.status(404).send({ status: 'error', message: `Device configuration not found for deviceId: ${deviceId}` });
        }

        const deviceAddress = deviceConfig.device.address;
        const bacnetObjectId = { type: parseInt(objectType, 10), instance: parseInt(objectInstance, 10) };
        const propIdToUse = parseInt(propertyId, 10);
        const appTagToUse = bacnetApplicationTag !== undefined ? parseInt(bacnetApplicationTag, 10) : undefined;
        const priorityToUse = priority !== undefined ? parseInt(priority, 10) : undefined;

        if (isNaN(bacnetObjectId.type) || isNaN(bacnetObjectId.instance) || isNaN(propIdToUse)) {
            return res.status(400).send({ status: 'error', message: 'objectType, objectInstance, and propertyId must be numbers.' });
        }
        if (priorityToUse !== undefined && (isNaN(priorityToUse) || priorityToUse < 1 || priorityToUse > 16)) {
            return res.status(400).send({ status: 'error', message: 'priority must be a number between 1 and 16.' });
        }
         if (appTagToUse !== undefined && isNaN(appTagToUse)) {
            return res.status(400).send({ status: 'error', message: 'bacnetApplicationTag must be a number.' });
        }


        try {
            const writeResponse = await this.bacnetClient.writeProperty(
                deviceAddress,
                bacnetObjectId,
                propIdToUse,
                value,
                priorityToUse,
                appTagToUse
            );
            res.status(200).send({ status: 'success', message: 'Write operation successful', response: writeResponse });
        } catch (error) {
            logger.log('error', `[API Write] Failed for DeviceId ${deviceId}: ${error.message || error}`);
            res.status(500).send({ status: 'error', message: `BACnet write operation failed: ${error.message || error}`, details: error });
        }
    }
}

module.exports = {Server};
