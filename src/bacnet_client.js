const bacnet = require('bacstack');
const { scheduleJob } = require('node-schedule');
const { EventEmitter } = require('events');
const { BacnetConfig } = require('./bacnet_config');
const { DeviceObjectId, DeviceObject, logger } = require('./common');

class BacnetClient extends EventEmitter {

    constructor() {
        super();
        this.client = new bacnet({ apduTimeout: 10000 });
        this.client.on('iAm', (device) => {
            this.emit('deviceFound', device);
        });

        this.bacnetConfig = new BacnetConfig();
        this.bacnetConfig.on('configLoaded', (config) => {
            this.startPolling(config.device, config.objects, config.polling.schedule);
        })
        this.bacnetConfig.load();
    }

    _readObjectList(deviceAddress, deviceId, callback) {
        // Read Device Object
        const requestArray = [{
            objectId: { type: bacnet.enum.ObjectTypes.OBJECT_DEVICE, instance: deviceId },
            properties: [
                { id: bacnet.enum.PropertyIds.PROP_OBJECT_LIST }
            ]
        }];
        this.client.readPropertyMultiple(deviceAddress, requestArray, callback);
    }

    _readObject(deviceAddress, type, instance, properties) {
        return new Promise((resolve, reject) => {
            const requestArray = [{
                objectId: { type: type, instance: instance },
                properties: properties
            }];
            this.client.readPropertyMultiple(deviceAddress, requestArray, (error, value) => {
                resolve({
                    error: error,
                    value: value
                });
            });
        });
    }

    _readObjectFull(deviceAddress, type, instance) {
        return this._readObject(deviceAddress, type, instance, [
            { id: bacnet.enum.PropertyIds.PROP_OBJECT_IDENTIFIER },
            { id: bacnet.enum.PropertyIds.PROP_OBJECT_NAME },
            { id: bacnet.enum.PropertyIds.PROP_OBJECT_TYPE },
            { id: bacnet.enum.PropertyIds.PROP_DESCRIPTION },
            { id: bacnet.enum.PropertyIds.PROP_UNITS },
            { id: bacnet.enum.PropertyIds.PROP_PRESENT_VALUE }
        ]);
    }

    _readObjectPresentValue(deviceAddress, type, instance) {
        return this._readObject(deviceAddress, type, instance, [
            { id: bacnet.enum.PropertyIds.PROP_PRESENT_VALUE },
            { id: bacnet.enum.PropertyIds.PROP_OBJECT_NAME}
        ]);
    }

    _findValueById(properties, id) {
        const property = properties.find(function (element) {
            return element.id === id;
        });
        if (property && property.value && property.value.length > 0) {
            return property.value[0].value;
        } else {
            return null;
        }
    };

    _mapToDeviceObject(object) {
        if (!object || !object.values) {
            return null;
        }

        const objectInfo = object.values[0].objectId;
        const deviceObjectId = new DeviceObjectId(objectInfo.type, objectInfo.instance);

        const objectProperties = object.values[0].values;
        const name = this._findValueById(objectProperties, bacnet.enum.PropertyIds.PROP_OBJECT_NAME);
        const description = this._findValueById(objectProperties, bacnet.enum.PropertyIds.PROP_DESCRIPTION);
        const type = this._findValueById(objectProperties, bacnet.enum.PropertyIds.PROP_OBJECT_TYPE);
        const units = this._findValueById(objectProperties, bacnet.enum.PropertyIds.PROP_UNITS);
        const presentValue = this._findValueById(objectProperties, bacnet.enum.PropertyIds.PROP_PRESENT_VALUE);

        return new DeviceObject(deviceObjectId, name, description, type, units, presentValue);
    }

    scanForDevices() {
        this.client.whoIs();
    }

    scanDevice(device) {
        return new Promise((resolve, reject) => {
            logger.log('info', `Reading full object list from device: ${device.address}`);
            this._readObjectList(device.address, device.deviceId, (err, result) => {
                if (!err) {
                    const objectArray = result.values[0].values[0].value;
                    const promises = [];

                    objectArray.forEach(object => {
                        promises.push(this._readObjectFull(device.address, object.value.type, object.value.instance));
                    });

                    Promise.all(promises).then((result) => {
                        const successfulResults = result.filter(element => !element.error);
                        const deviceObjects = successfulResults.map(element => this._mapToDeviceObject(element.value));
                        logger.log('info', `Objects found: ${deviceObjects.length}`);
                        this.emit('deviceObjects', device, deviceObjects);
                        resolve(deviceObjects);
                    }).catch((error) => {
                        logger.log('error', `Error whilte fetching objects: ${error}`);
                        reject(error);
                    });
                } else {
                    logger.log('error', `Error whilte fetching objects: ${err}`);
                }
            });
        });
    }

    startPolling(device, objects, scheduleExpression) {
        logger.log('info', `Schedule polling for device ${device.address} with expression ${scheduleExpression}`);
        scheduleJob(scheduleExpression, () => {
            logger.log('info', 'Fetching device object values');
            const promises = [];
            objects.forEach(deviceObject => {
                promises.push(this._readObjectPresentValue(device.address, deviceObject.objectId.type, deviceObject.objectId.instance));
            });
            Promise.all(promises).then((result) => {
                const values = {};
                // remove errors and map to result element
                const successfulResults = result.filter(element => !element.error).map(element => element.value);
                successfulResults.forEach(object => {
                    const objectId = object.values[0].objectId.type + '_' + object.values[0].objectId.instance;
                    const presentValue = this._findValueById(object.values[0].values, bacnet.enum.PropertyIds.PROP_PRESENT_VALUE);
                    const objectName = this._findValueById(object.values[0].values, bacnet.enum.PropertyIds.PROP_OBJECT_NAME);

                    values[objectId] = {};
	                  values[objectId].value = presentValue;
	                  values[objectId].name = objectName;
                });
                this.emit('values', device, values);
            }).catch(function (error) {
                logger.log('error', `Error whilte fetching values: ${error}`);
            });
        });
    }

    saveConfig(config) {
        this.bacnetConfig.save(config);
    }
}

module.exports = { BacnetClient };
