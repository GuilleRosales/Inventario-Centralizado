const express = require('express');
const { authService, authGuard } = require('../../core/container');
const { AuthController } = require('./AuthController');

const router = express.Router();
const controller = new AuthController(authService);

router.post('/login', controller.handle(controller.login));
router.get('/me', authGuard.authenticate(), controller.handle(controller.me));

module.exports = router;
