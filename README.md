# BACnet MQTT Gateway

BACnet MQTT Gateway is gateway that connects BACnet devices via MQTT to the cloud. It is written in Javascript and uses node.

For BACnet connection the [Node BACstack](https://github.com/fh1ch/node-bacstack) is used.

## Functionalities

* Discover BACnet devices in network (WhoIs)
* Read object list from BACnet device (Read Property)
* Read present value from defined list of BACnet objects and send it to an MQTT broker
* Write to BACnet object properties via MQTT or Web UI
    * Configurable Property ID, Write Priority, and BACnet Application Tag for writes.
    * MQTT feedback for write success/failure.
* REST and web interface for configuration and interaction
    * Web UI includes a "Stop Scan" button for device discovery.
* API documentation via Swagger UI.

## Getting started

1. Clone repo and install npm dependencies:

    ```shell
    git clone https://github.com/2pk03/bacnet-mqtt-gateway.git
    cd bacnet-mqtt-gateway
    npm install
    ```

2. Configure gateway:

    Configuration is primarily managed via environment variables, typically loaded from a `.env` file in the project root. Create a `.env` file by copying `.env.example` (if it exists) or creating a new one.

    **Key Environment Variables (for `.env` file):**
    ```dotenv
    # MQTT Broker Configuration
    MQTT_HOST=your_mqtt_broker_host
    MQTT_PORT=1883 # Or your MQTT broker port
    MQTT_USERNAME=your_mqtt_username
    MQTT_PASSWORD=your_mqtt_password
    MQTT_GATEWAY_ID=my_bacnet_gateway_1 # Unique ID for this gateway instance

    # HTTP Server Configuration
    HTTP_PORT=8082 # Port for the web UI and REST API

    # Logging Configuration
    LOG_LEVEL=info # e.g., debug, info, warn, error
    ```

    Default fallback values are present in `config/default.json`. The mapping between environment variables and the configuration structure is defined in `config/custom-environment-variables.json`.
    The original MQTT configuration using certificate paths in `config/default.json` has been replaced by username/password authentication via environment variables.

3. Start the gateway and open admin interface

    ```shell
    npm start
    ```
    Once started, the admin interface is typically available at `http://localhost:PORT/admin/` (e.g., `http://localhost:8082/admin/`).
    API documentation is available at `http://localhost:PORT/api-docs/`.

## Device polling configuration

The gateway can poll BACnet object present values and send the values via MQTT into the cloud. To configure polling for a BACnet device you can put a .json file into the devices folder.

```json
{
    "device": {
        "deviceId": 114,
        "address": "192.168.178.55"
    },
    "polling": {
        "schedule": "*/15 * * * * *"
    },
    "objects": [{
        "objectId": {
            "type": 2,
            "instance": 202
        }
    }, {
        "objectId": {
            "type": 2,
            "instance": 203
        }
    }]
}
```

You need to define the device id, ip address, schedule interval (as CRON expression) and the objects to poll.

When the gateway is started it automatically reads the list of files from the directory and starts the polling for all devices.
 
## REST API

To execute commands the gateway offers a REST API under `http://localhost:8082/api/bacnet`.

The following endpoints are supported:

* `PUT /api/bacnet`: Scan for devices (WhoIs)
    
    Scans for BACnet devices in the network (5s) and returns the answers. Body is empty.
    
    Example:
    ```
    PUT http://localhost:8082/api/bacnet/scan
    ```  
    (Body is empty)
    
* `PUT /api/bacnet/{deviceId}/objects`: Scan device for objects

    Scans a specific device for objects and returns the list of found objects.
    The request body should contain the `deviceId` and `address` of the target device.
    
    Example:
    ```
    PUT http://localhost:8082/api/bacnet/114/objects 
    # Request Body:
    {
        "deviceId":"114", 
        "address":"192.168.1.101"
    }
    ```
    
* `PUT /api/bacnet/{deviceId}/config`: Configure polling for a device

    Configures and starts polling for a specific device. The request body is the device configuration JSON (same structure as files in the `devices/` folder).
    
    Example:
    ```
    PUT http://localhost:8082/api/bacnet/114/config
    # Request Body: (see "Device polling configuration" section for structure)
    { ... device config ... }
    ```

* `PUT /api/bacnet/write`: Write to a BACnet object property

    Writes a value to a specified property of a BACnet object.
    Request Body:
    ```json
    {
      "deviceId": "114", // Configured deviceId for the target device
      "objectType": 1,     // BACnet Object Type (e.g., 1 for Analog Output)
      "objectInstance": 0, // BACnet Object Instance
      "propertyId": 85,    // BACnet Property ID (e.g., 85 for Present_Value)
      "value": 50.0,       // Value to write
      "priority": 8,       // Optional: Write priority (1-16)
      "bacnetApplicationTag": 4 // Optional: BACnet Application Tag (e.g., 4 for REAL)
    }
    ```

For a complete and interactive API specification, please refer to the Swagger UI documentation available at `/api-docs` when the gateway is running.

## MQTT Interface

### Reading Data (Polling)

Polled BACnet object values are published to MQTT topics, typically structured for Home Assistant integration:
`homeassistant/<component_type>/<gateway_id>/<objectType>_<objectInstance>/state`
Example: `homeassistant/sensor/my_bacnet_gateway_1/2_202/state`
The payload is the JSON stringified value of the object's Present\_Value.

### Writing Data (Commands)

To write to a BACnet object, publish a message to the following MQTT topic:
`bacnetwrite/<gateway_id>/<device_id>/<objectType>_<objectInstance>/<property_id>/set`

*   `<gateway_id>`: The `MQTT_GATEWAY_ID` configured in your `.env` file.
*   `<device_id>`: The `deviceId` of the target BACnet device as defined in its configuration file in the `devices/` folder (e.g., "114").
*   `<objectType>_<objectInstance>`: The BACnet object type and instance (e.g., "1_0" for Analog Output 0).
*   `<property_id>`: The numeric BACnet Property ID to write to (e.g., "85" for Present\_Value).

**MQTT Payload for Writes:**
A JSON string with a `value` field and optional `priority` and `bacnetApplicationTag` fields:
```json
{
  "value": 25.5,
  "priority": 8,
  "bacnetApplicationTag": 4 
}
```
*   `value`: The value to write.
*   `priority` (optional): BACnet write priority (1-16).
*   `bacnetApplicationTag` (optional): Explicit BACnet Application Tag (e.g., 1 for BOOLEAN, 4 for REAL, 7 for CHARACTER_STRING). If not provided, the gateway attempts basic type inference.

**MQTT Write Status Feedback:**
After a write attempt, a status message is published to:
`bacnetwrite_status/<gateway_id>/<device_id>/<objectType>_<objectInstance>/<property_id>`
Payload: `{"status": "success/error", "detail": "...", ...}`

## Run with Docker

Gateway can also be run as a docker container. Just build the image and start a container:

```shell
docker build -t bacnet-mqtt-gateway
docker run -p 8082:8082 -v /mnt/bacnet-gateway/devices:/usr/src/app/devices -v /mnt/bacnet-gateway/config:/usr/src/app/config bacnet-mqtt-gateway
```

With the specified file mountings you can put the config file under `/mnt/bacnet-gateway/config` and the device configs under `/mnt/bacnet-gateway/devices` on the host system.
