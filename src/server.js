const express = require('express');
const config = require('config');
const cors = require('cors');
const { json } = require('body-parser');
const { logger } = require('./common');

const port = config.get('httpServer.port');

class Server {

    constructor(bacnetClient) {

        this.bacnetClient = bacnetClient;
        
        this.app = express();        
        this.app.use(json());
        this.app.use(cors());
        this.app.use('/admin', express.static('web'));

        // define REST api
        this.app.put('/api/bacnet/scan', this._scanForDevices.bind(this));
        this.app.put('/api/bacnet/:deviceId/objects', this._scanDevice.bind(this));
        this.app.put('/api/bacnet/:deviceId/config', this._configurePolling.bind(this));

        // start server
        this.app.listen(port, () => {
            logger.log('info', `Gateway server listening on port ${port}`);
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

}

module.exports = {Server};