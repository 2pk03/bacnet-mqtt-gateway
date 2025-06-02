Vue.component('spinner', {
    template: '#spinner'
});

Vue.component('whois', {
    data() {
        return {
            loading: false,
            devices: null,
            cancelTokenSource: null 
        }
    },
    methods: {
        whois() {
            if (this.loading && this.cancelTokenSource) {
                return;
            }

            this.loading = true;
            this.devices = null; 
            this.cancelTokenSource = axios.CancelToken.source();

            axios.put('/api/bacnet/scan', {}, { cancelToken: this.cancelTokenSource.token })
                .then(response => {
                    this.devices = response.data;
                    this.loading = false;
                    this.cancelTokenSource = null;
                })
                .catch(error => {
                    if (axios.isCancel(error)) {
                        console.log('Whois scan request canceled:', error.message);
                    } else {
                        console.error('Error during Whois scan:', error);
                    }
                    this.loading = false;
                    this.cancelTokenSource = null;
                });
        },
        stopWhoisScan() {
            if (this.cancelTokenSource) {
                this.cancelTokenSource.cancel('Scan stopped by user.');
            }
        }
    }
});

Vue.component('device-scan', {
    data() {
        return {
            loading: false,
            deviceId: null, 
            address: null,  
            objects: null,
            showWriteForm: false,
            selectedObjectForWrite: null
        }
    },
    methods: {
        scanDevice() {
            this.loading = true; 
            axios.put('/api/bacnet/' + this.deviceId + '/objects', { 
                deviceId: this.deviceId,
                address: this.address  
            }).then(response => {
                this.objects = response.data;
                this.loading = false;
            }).catch(error => {
                this.loading = false;
            });
        },
        openWriteForm(scannedObject) {
            this.selectedObjectForWrite = {
                parentDeviceId: this.deviceId, 
                objectType: scannedObject.objectId.type,
                objectInstance: scannedObject.objectId.instance,
                initialObjectName: scannedObject.name
            };
            this.showWriteForm = true;
        },
        closeWriteForm() {
            this.showWriteForm = false;
            this.selectedObjectForWrite = null;
        },
        handleWriteSuccessful() {
            this.closeWriteForm();
            // Optionally, could re-trigger scanDevice() if desired, but might be too aggressive
            // this.scanDevice(); 
        },
        getObjects(device) { 
            console.log(device);
        }
    }
});

Vue.component('object-write-form', {
    props: ['deviceId', 'objectType', 'objectInstance', 'initialObjectName'],
    template: '#object-write-form-template', 
    data() {
        return {
            loading: false,
            valueToWrite: null,
            propertyId: 85, 
            priority: null, 
            bacnetApplicationTag: null, 
            writeStatus: null,
            errorMessage: null,
            commonProperties: [
                { text: 'Present Value (85)', value: 85 },
                { text: 'Object Name (77)', value: 77 },
                { text: 'Description (28)', value: 28 },
                { text: 'Reliability (103)', value: 103 },
                { text: 'Out Of Service (81)', value: 81 },
            ],
            commonAppTags: [
                { text: 'NULL (0)', value: 0 },
                { text: 'BOOLEAN (1)', value: 1 },
                { text: 'UNSIGNED_INT (2)', value: 2 },
                { text: 'SIGNED_INT (3)', value: 3 },
                { text: 'REAL (4)', value: 4 },
                { text: 'DOUBLE (5)', value: 5 },
                { text: 'CHARACTER_STRING (7)', value: 7 },
                { text: 'ENUMERATED (9)', value: 9 },
            ]
        };
    },
    methods: {
        submitWrite() {
            this.loading = true;
            this.writeStatus = null;
            this.errorMessage = null;

            const payload = {
                deviceId: this.deviceId,
                objectType: parseInt(this.objectType),
                objectInstance: parseInt(this.objectInstance),
                propertyId: parseInt(this.propertyId),
                value: this.valueToWrite, 
            };

            if (this.priority !== null && this.priority !== '') {
                payload.priority = parseInt(this.priority);
            }
            if (this.bacnetApplicationTag !== null && this.bacnetApplicationTag !== '') {
                payload.bacnetApplicationTag = parseInt(this.bacnetApplicationTag);
            }

            axios.put('/api/bacnet/write', payload)
                .then(response => {
                    this.loading = false;
                    this.writeStatus = 'success';
                    this.errorMessage = `Success: ${response.data.message || JSON.stringify(response.data)}`;
                    this.$emit('write-successful');
                })
                .catch(error => {
                    this.loading = false;
                    this.writeStatus = 'error';
                    if (error.response && error.response.data && error.response.data.message) {
                        this.errorMessage = `Error: ${error.response.data.message}`;
                    } else {
                        this.errorMessage = `Error: ${error.message || 'Failed to perform write operation.'}`;
                    }
                });
        },
        closeForm() {
            this.$emit('close-write-form');
        }
    }
});

new Vue({
    el: "#app",
    data() {
        return {
            state: null,
        }
    },
    methods: {
        showWhois() {
            this.state = 'whois';
        },
        showObjects() {
            this.state = 'objects';
        }
    }
});
