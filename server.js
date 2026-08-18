const cluster = require('cluster');
const os = require('os');

const numCPUs = os.cpus().length;
console.log(`Number of CPUs: ${numCPUs}`);

if (cluster.isPrimary) {
    console.log(`Master process is running`);
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
} else {
    console.log(`Worker process is running`);
    const express = require('express');
    const app = express();
    app.get('/', (req, res) => {
        res.send(`Hello World ${process.pid} ${cluster.worker.id}`);
    });
    app.listen(8000, () => {
        console.log(`Server is running on port 8000 ${process.pid}`);
    });
}