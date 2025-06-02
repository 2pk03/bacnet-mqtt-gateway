const { createLogger, format, transports } = require('winston');
const config = require('config'); 

const logger = createLogger({
    level: config.get('logger.level'), 
    format: format.combine(
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.json()
    ),
    transports: [new transports.Console()],
});

class DeviceObjectId {
    constructor(type, instance) {
        this.type = type;
        this.instance = instance;
    }
}

class DeviceObject {
    constructor(objectId, name, description, type, units, presentValue) {
        this.objectId = objectId;
        this.name = name;
        this.description = description;
        this.type = type;
        this.units = units;
        this.presentValue = presentValue;
    }
}

module.exports = { DeviceObjectId, DeviceObject, logger };
