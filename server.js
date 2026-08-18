const cluster = require('cluster');
const os = require('os');

require('dotenv/config');

const PORT = process.env.PORT || 3005;
const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
    console.log(`Master ${process.pid} forking ${numCPUs} workers`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker) => {
        console.log(`Worker ${worker.process.pid} died — forking a replacement`);
        cluster.fork();
    });
} else {
    const app = require('./app');

    app.listen(PORT, () => {
        console.log(`Worker ${process.pid} listening on ${PORT}`);
    });
}
