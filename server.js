var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
const _os = require('os');

const os = require('os-utils');
const df = require('node-df');
const batteryLevel = require('battery-level');
const osu = require('node-os-utils')
const si = require('systeminformation');

app.get('/dataSys', function(req, res) {
  res.sendFile(__dirname + '/liveMetrics.html');
});

http.listen(3000, () => {
  console.log(`server running at port 3000`);
});

// When a client connects
io.on('connection', function(socket) {
  console.log('Client connected');

  // Send system metrics to the client every second
  const interval = setInterval(function() {
    const metrics = getSystemMetrics();
    socket.emit('metrics', metrics);
  }, 1000);

  // When a client disconnects
  socket.on('disconnect', function() {
    console.log('Client disconnected');
    clearInterval(interval);
  });
});

let designedCapacity = 0;
  let maxCapacity = 0;
  let currentCapacity = 0;
  let capacityUnit = '';

  const cpu = osu.cpu;
  let cpuUsageVal = 0;  
  let frequency = 0;
  
  let cpuSpeed = 0;
  let speedMin = 0;
  let speedMax = 0;

  let cpuTemperature = 0;
  let cpuTemperatureMin = 0;
  let cpuTemperatureMax = 0;
  
  let dataTransferred = 0;
  let dataReceived = 0;
  let rIO = 0;
  let wIO = 0;
  let tIO = 0;

  let totalSize = 0;
  let totalUsed = 0;

  df(function(error, response) {
    if (error) { throw error; }
    for (const drive of response) {
        totalSize += drive.size;
        totalUsed += drive.used;
      }
  });

// Function to get system metrics
function getSystemMetrics() {

  // setInterval(function() {

    cpu.usage()
      .then(response => {
        cpuUsageVal=response;
      });

    si.battery().then((bat) => {
      designedCapacity = bat.designedCapacity;
      maxCapacity = bat.maxCapacity;
      currentCapacity = bat.currentCapacity
      capacityUnit = bat.capacityUnit;
    }).catch((err) => {
      console.error(err);
    });

    si.wifiNetworks().then((wifi) => {
      frequency = wifi[0].frequency || 0;
    }).catch((err) => {
      console.error(err);
    });

    si.cpu().then((cpu) => {
      cpuSpeed = cpu.speed;
      speedMin = cpu.speedMin;
      speedMax = cpu.speedMax;
    }).catch((err) => {
      console.error(err);
    });

    si.cpuTemperature().then((data) => {
      cpuTemperature = Math.max(...data.cores);
      cpuTemperatureMin = Math.min(...data.cores);;
      cpuTemperatureMax = data.max;
     }).catch((err) => {
      console.error(err);
    });

    si.networkStats().then(data => {
      dataTransferred = data[0].tx_sec / 125;
      dataReceived = data[0].rx_sec / 125;
    });

    si.disksIO().then(data => {
      rIO = data.rIO * Math.pow(10, -6);
      wIO = data.wIO * Math.pow(10, -6);
      tIO = data.tIO * Math.pow(10, -6);
    });
  // }, 1000);


  const localLiveMonitoring = {
    "systemMetrics": {
      "metrics": {
          "cpu": {
              "label": "CPU",
              "unit": "%",
              "min": 3,
              "med": 50,
              "max": 100,
              "current": +(`${cpuUsageVal}`)
          },
          "cpuTemperature": {
              "label": "CPU Temperature",
              "unit": "°C",
              "min": cpuTemperatureMin,
              "med": (cpuTemperatureMin + cpuTemperatureMax)/2,
              "max": cpuTemperatureMax,
              "current": cpuTemperature
          },
          "storage": {
              "label": "Storage",
              "unit": "GB",
              "min": +((totalSize*0.02/1024/1024).toFixed(2)),
              "med": +((totalSize/2/1024/1024).toFixed(2)),
              "max": +((totalSize/1024/1024).toFixed(2)),
              "current": +((totalUsed/1024/1024).toFixed(2))
          },
          "ram": {
            "label": "RAM",
            "unit": "GB",
            "min": +((_os.totalmem()/10/1024/1024/1024).toFixed(2)),
            "med": +((_os.totalmem()/2/1024/1024/1024).toFixed(2)),
            "max": +((_os.totalmem()/1024/1024/1024).toFixed(2)),
            "current": +(((_os.totalmem()-_os.freemem())/1024/1024/1024).toFixed(2))
          },
          "wifiFrequency": {
              "label": "wifiFrequency",
              "unit": "MHz",
              "min": 0,
              "med": 2437,
              "max": 6000,
              "current": frequency
          }
      },
      "layer": {
          "systemMetrics-layer": {
              "label": os.platform()+" System metrics",
              "_layerBehavior": "something",
              "_defaultColor": "green",
              "_publicColorOption": "random calls function to pick a color",
          },
      },
  },
  "qosMetrics": {
      "metrics": {
        "totalDataReceived": {
            "label": "Data Received",
            "unit": "KB / seconds",
            "min": 0,
            "med": 10000,
            "max": 100000,
            "current": dataReceived.toFixed(2)
          },
          "totalDataTransferred": {
            "label": "Data Transferred",
            "unit": "KB / seconds",
            "min": 0,
            "med": 10000,
            "max": 100000,
            "current": dataTransferred.toFixed(2)
          },
        "cpuSpeed": {
          "label": "CPU Speed",
          "unit": "GHz",
          "min": speedMin,
          "med": ((speedMax+speedMin)/2).toFixed(2),
          "max": speedMax,
          "current": cpuSpeed.toFixed(2)
        },
        "readIOPS": {
          "label": "read Input/Output operations",
          "unit": "MB / second",
          "min": 0,
          "med": tIO/2,
          "max": tIO,
          "current": rIO.toFixed(2)
        },
        "writeIOPS": {
          "label": "write Input/Output operations ",
          "unit": "MB / second",
          "min": 0,
          "med": wIO*2,
          "max": wIO*3,
          "current": wIO.toFixed(2)
        },
      },
      "layer": {
          "qosMetrics-layer": {
              "label": os.platform()+" Qos metrics",
              "_layerBehavior": "something",
              "_defaultColor": "green",
              "_publicColorOption": "random calls function to pick a color"
          }
      }
    }
  };
  return localLiveMonitoring;
};
