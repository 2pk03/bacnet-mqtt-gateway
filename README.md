# BACnet MQTT Gateway

BACnet MQTT Gateway is gateway that connects BACnet devices via MQTT to the cloud. It is written in Javascript and uses node.

For BACnet connection the [Node BACstack](https://github.com/fh1ch/node-bacstack) is used.

## Functionalities

* Discover BACnet devices in network (WhoIs)
* Read object list from BACnet device (Read Property)
* Read present value from defined list of BACnet objects and send it to an MQTT broker
* REST and web interface for configuration

## Getting started

1. Clone repo and install npm dependencies:

    ```shell
    git clone https://github.com/infinimesh/bacnet-mqtt-gateway.git
    cd bacnet-mqtt-gateway
    npm install
    ```

2. Configure gateway:

    By default the gateway is configured to use [infinimesh.cloud](https://console.infinimesh.cloud) platform, but it can be used with any MQTT broker.
    
    Open `config/default.json` and change MQTT configuration by defining your device id and the path to the device certificate files.
    
    ```
    {
        "mqtt": {
            "gatewayId": "{{device id}}",
            "host": "mqtt.api.infinimesh.cloud",
            "port": 8883,
            "authentication": {
                "certPath": "{{device .crt file path}}",
                "keyPath": "{{device .key file path}}"
            }
        },
        "bacnet": {
            "configFolder": "./devices/"
        },
        "httpServer": {
            "enabled": true,
            "port": 8082
        }
    }
    ```
    
3. Start the gateway and open admin interface

    ```shell
    npm start
    open http://localhost:8082/admin
    ```

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
    
* `PUT /api/bacnet/{deviceId}/objects`: Scan device for object

    Scans a specific device for objects and returns the list of found objects. Device ID and IP address must be provided.
    
    Example:
    ```
    PUT http://localhost:8082/api/bacnet/22/objects
    {
        "deviceId":"22",
        "address":"192.168.178.99"
    }
    ```
    
* `PUT /api/{deviceId}/config`: Configure polling for device

    Configures and starts polling for a specific device. Body is the same as the polling configuration files described in the previous section.
    
    Example:
    ```
    PUT http://localhost:8082/api/bacnet/114/config
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

## Run with Docker

Gateway can also be run as a docker container. Just build the image and start a container:

```shell
docker build -t bacnet-mqtt-gateway
docker run -p 8082:8082 -v /mnt/bacnet-gateway/devices:/usr/src/app/devices -v /mnt/bacnet-gateway/config:/usr/src/app/config bacnet-mqtt-gateway
```

With the specified file mountings you can put the config file under `/mnt/bacnet-gateway/config` and the device configs under `/mnt/bacnet-gateway/devices` on the host system.