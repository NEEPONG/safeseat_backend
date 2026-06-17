const app = require('./app');

const PORT = process.env.PORT || 3000;

const DispatcherService = require('./services/dispatcherService');

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    DispatcherService.start();
});