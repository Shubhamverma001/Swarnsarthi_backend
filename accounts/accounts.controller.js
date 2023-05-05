const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validateRequest = require('_middleware/validate-request');
const authorize = require('_middleware/authorize')
const Role = require('_helpers/role');
const accountService = require('./account.service');

// routes
router.post('/authenticate', authenticateSchema, authenticate);
router.post('/volunteer',authorize(), volunteerSchema, addVolunteer);
router.post('/elderly',authorize(), elderlySchema, addElderly);
router.get('/volunteer',authorize(), getVolunteer);
router.get('/elderly',authorize(), getElderly);
router.post('/find-volunteer',authorize(), findVolunteerSchema, findVolunteer);
router.get('/volunteer-bookings',authorize(), getVolunteerBookings);
router.get('/elderly-bookings',authorize(), getElderlyBookings);
router.post('/volunteer-bookings',authorize(), bookingRequest);
router.post('/refresh-token', refreshToken);
router.post('/revoke-token', authorize(), revokeTokenSchema, revokeToken);
router.post('/register', registerSchema, register);
router.post('/verify-email', verifyEmailSchema, verifyEmail);
router.post('/forgot-password', forgotPasswordSchema, forgotPassword);
router.post('/validate-reset-token', validateResetTokenSchema, validateResetToken);
router.post('/reset-password', resetPasswordSchema, resetPassword);
router.get('/', authorize(Role.Admin), getAll);
router.get('/:id', authorize(), getById);
router.post('/', authorize(Role.Admin), createSchema, create);
router.put('/:id', authorize(), updateSchema, update);
router.delete('/:id', authorize(), _delete);


module.exports = router;

function authenticateSchema(req, res, next) {
    const schema = Joi.object({
        email: Joi.string().required(),
        password: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

function elderlySchema(req, res, next) {
    const schema = Joi.object({
        age: Joi.number().required(),
        gender: Joi.string().required(),
        city: Joi.string().required(),
        address: Joi.string().required(),
    });
    validateRequest(req, next, schema);
}

function volunteerSchema(req, res, next) {
    const schema = Joi.object({
        gender: Joi.string().required(),
        city: Joi.string().required(),
        hourlyCharge: Joi.number().required(),
        age: Joi.number().required(),
    });
    validateRequest(req, next, schema);
}

function findVolunteerSchema(req, res, next) {
    const schema = Joi.object({
        days: Joi.number().required(),
        hours: Joi.number().required(),
        budget: Joi.number().required(),
    });
    validateRequest(req, next, schema);
}

function authenticate(req, res, next) {
    const { email, password } = req.body;
    const ipAddress = req.ip;
    accountService.authenticate({ email, password, ipAddress })
        .then(({ refreshToken, ...account }) => {
            //setTokenCookie(res, refreshToken);
            res.json({ refreshToken, ...account });
        })
        .catch(next);
}

function addElderly(req, res, next) {
    const { age, gender, city, address } = req.body;
    const user=req.user.id;
    accountService.addElderly({ age, gender, city, address,accountId:user})
        .then(({ age, gender, city, address}) => {
            //setTokenCookie(res, refreshToken);
            res.json({ age, gender, city, address});
        })
        .catch(next);
}

function getElderly(req, res, next) {
    const user=req.user.id;
    accountService.getElderly(user)
        .then(({ age, gender, city, address}) => {
            //setTokenCookie(res, refreshToken);
            res.json({ age, gender, city, address});
        })
        .catch(next);
}

function getVolunteer(req, res, next) {
    const user=req.user.id;
    accountService.getVolunteer(user)
        .then(({ age, gender, city, hourlyCharge}) => {
            //setTokenCookie(res, refreshToken);
            res.json({ age, gender, city, hourlyCharge });
        })
        .catch(next);
}

function findVolunteer(req, res, next) {
    const user=req.user.id;
    const {days,hours,budget}=req.body;
    accountService.findVolunteer(user, days, hours, budget)
        .then((volunteers) => {
            //setTokenCookie(res, refreshToken);
            res.json(volunteers);
        })
        .catch(next);
}

function getVolunteerBookings(req, res, next){
    const user=req.user.id; 
    accountService.getVolunteerBookings(user)
        .then((bookings) => {
            //setTokenCookie(res, refreshToken);
            res.json(bookings);
        })
        .catch(next);
}

function getElderlyBookings(req, res, next){
    const user=req.user.id; 
    accountService.getElderlyBookings(user)
        .then((bookings) => {
            //setTokenCookie(res, refreshToken);
            res.json(bookings);
        })
        .catch(next);
}


function addVolunteer(req, res, next) {
    const {age, gender, city, hourlyCharge} = req.body;
    const user=req.user.id; 
    accountService.addVolunteer({ age, gender, city, hourlyCharge,accountId:user})
        .then(({ age, gender, city, hourlyCharge}) => {
            //setTokenCookie(res, refreshToken);
            res.json({ age, gender, city, hourlyCharge});
        })
        .catch(next);
}

function bookingRequest(req, res, next) {
    const user=req.user.id;
    const {days,hours,budget,volunteerId}=req.body;
    accountService.bookingRequest(user, days, hours, budget,volunteerId)
        .then((response) => {
            //setTokenCookie(res, refreshToken);
            res.json(response);
        })
        .catch(next);
}

function refreshToken(req, res, next) {
    const token = req.body.refreshToken;
    const ipAddress = req.ip;
    accountService.refreshToken({ token, ipAddress })
        .then(({ refreshToken, ...account }) => {
            setTokenCookie(res, refreshToken);
            res.json(account);
        })
        .catch(next);
}

function revokeTokenSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().empty('')
    });
    validateRequest(req, next, schema);
}

function revokeToken(req, res, next) {
    // accept token from request body or cookie
    const token = req.body.token || req.cookies.refreshToken;
    const ipAddress = req.ip;

    if (!token) return res.status(400).json({ message: 'Token is required' });

    // users can revoke their own tokens and admins can revoke any tokens
    if (!req.user.ownsToken(token) && req.user.role !== Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    accountService.revokeToken({ token, ipAddress })
        .then(() => res.json({ message: 'Token revoked' }))
        .catch(next);
}

function registerSchema(req, res, next) {
    const schema = Joi.object({
        title: Joi.string().required(),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        acceptTerms: Joi.boolean().valid(true).required(),
        role:Joi.string().required(),
    });
    validateRequest(req, next, schema);
}

function register(req, res, next) {
    accountService.register(req.body, req.get('origin'))
        .then(() => res.json({ message: 'Registration successful, please check your email for verification instructions' }))
        .catch(next);
}

function verifyEmailSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

function verifyEmail(req, res, next) {
    accountService.verifyEmail(req.body)
        .then(() => res.json({ message: 'Verification successful, you can now login' }))
        .catch(next);
}

function forgotPasswordSchema(req, res, next) {
    const schema = Joi.object({
        email: Joi.string().email().required()
    });
    validateRequest(req, next, schema);
}

function forgotPassword(req, res, next) {
    accountService.forgotPassword(req.body, req.get('origin'))
        .then(() => res.json({ message: 'Please check your email for password reset instructions' }))
        .catch(next);
}

function validateResetTokenSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

function validateResetToken(req, res, next) {
    accountService.validateResetToken(req.body)
        .then(() => res.json({ message: 'Token is valid' }))
        .catch(next);
}

function resetPasswordSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required()
    });
    validateRequest(req, next, schema);
}

function resetPassword(req, res, next) {
    accountService.resetPassword(req.body)
        .then(() => res.json({ message: 'Password reset successful, you can now login' }))
        .catch(next);
}

function getAll(req, res, next) {
    accountService.getAll()
        .then(accounts => res.json(accounts))
        .catch(next);
}

function getById(req, res, next) {
    // users can get their own account and admins can get any account
    if (Number(req.params.id) !== req.user.id && req.user.role !== Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    accountService.getById(req.params.id)
        .then(account => account ? res.json(account) : res.sendStatus(404))
        .catch(next);
}

function createSchema(req, res, next) {
    const schema = Joi.object({
        title: Joi.string().required(),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
        role: Joi.string().valid(Role.Admin, Role.User).required()
    });
    validateRequest(req, next, schema);
}

function create(req, res, next) {
    accountService.create(req.body)
        .then(account => res.json(account))
        .catch(next);
}

function updateSchema(req, res, next) {
    const schemaRules = {
        title: Joi.string().empty(''),
        firstName: Joi.string().empty(''),
        lastName: Joi.string().empty(''),
        email: Joi.string().email().empty(''),
        password: Joi.string().min(6).empty(''),
        confirmPassword: Joi.string().valid(Joi.ref('password')).empty('')
    };

    // only admins can update role
    if (req.user.role === Role.Admin) {
        schemaRules.role = Joi.string().valid(Role.Admin, Role.User).empty('');
    }

    const schema = Joi.object(schemaRules).with('password', 'confirmPassword');
    validateRequest(req, next, schema);
}

function update(req, res, next) {
    // users can update their own account and admins can update any account
    if (Number(req.params.id) !== req.user.id && req.user.role !== Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    accountService.update(req.params.id, req.body)
        .then(account => res.json(account))
        .catch(next);
}

function _delete(req, res, next) {
    // users can delete their own account and admins can delete any account
    if (Number(req.params.id) !== req.user.id && req.user.role !== Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    accountService.delete(req.params.id)
        .then(() => res.json({ message: 'Account deleted successfully' }))
        .catch(next);
}

// helper functions

function setTokenCookie(res, token) {
    // create cookie with refresh token that expires in 7 days
    const cookieOptions = {
        httpOnly: true,
        expires: new Date(Date.now() + 7*24*60*60*1000)
    };
    res.cookie('refreshToken', token, cookieOptions);
}