const express = require('express');
// const router = express.Router();
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv/config');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const TaskRoutes = require('./routes/task')
const AuthRoutes = require('./routes/auth')

app.use('/tasks', TaskRoutes)
app.use('/auth', AuthRoutes)

// handle 404
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// global error handler — 4 parameters required!
app.use((err, req, res, next) => {
    console.log('Error:', err.message);

    const status = err.status || (err.name === 'ValidationError' ? 400 : 500);

    res.status(status).json({
        message: err.message || 'Internal server error'
    });
});
mongoose.connect(process.env.DB_CONNECTION)
    .then(() => console.log('Connected to database'))
    .catch((err) => console.error('Database connection error:', err.message));

app.listen(process.env.PORT, () => {
    console.log(`server running in ${process.env.PORT}`)
})





