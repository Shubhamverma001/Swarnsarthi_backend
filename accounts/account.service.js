﻿const config = require("config.json");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { Op } = require("sequelize");
const sendEmail = require("_helpers/send-email");
const db = require("_helpers/db");
const Role = require("_helpers/role");
const { isAsyncFunction } = require("util/types");
const Stripe = require("stripe");
//const stripe = new Stripe('ENTER YOUR STRIPE KEY TO USE STRIPE PAYMENT SERVICE',{
  apiVersion:'2022-11-15',
//});

module.exports = {
  authenticate,
  refreshToken,
  revokeToken,
  register,
  verifyEmail,
  forgotPassword,
  validateResetToken,
  resetPassword,
  getAll,
  getById,
  create,
  update,
  addElderly,
  addVolunteer,
  getVolunteer,
  getElderly,
  findVolunteer,
  getVolunteerBookings,
  delete: _delete,
  getElderlyBookings,
  bookingRequest,
  addBankAccount,
  updateBankAccount
};

async function authenticate({ email, password, ipAddress }) {
  const account = await db.Account.scope("withHash").findOne({
    where: { email },
  });

  if (
    !account ||
    !account.isVerified ||
    !(await bcrypt.compare(password, account.passwordHash))
  ) {
    throw "Email or password is incorrect";
  }

  // authentication successful so generate jwt and refresh tokens
  const jwtToken = generateJwtToken(account);
  const refreshToken = generateRefreshToken(account, ipAddress);

  // save refresh token
  await refreshToken.save();

  // return basic details and tokens
  return {
    ...basicDetails(account),
    jwtToken,
    refreshToken: refreshToken.token,
  };
}

async function addElderly({ age, gender, city, address,accountId }) {
  const savedElderly = await db.Elderly.findOne({ where: { accountId } });
  console.log("saved elderly is",savedElderly);
  if(savedElderly){
    savedElderly.city = city;
    savedElderly.address = address;
    await savedElderly.save();
    return{
      age: savedElderly.age,
      address: savedElderly.address,
      city: savedElderly.city,
      gender: savedElderly.gender
    }
  }
  else{
    console.log("NOT SAVED ELDERLY");
    const elderly = new db.Elderly({ age, gender, city, address,accountId });
    await elderly.save();
  }
  
  return { age, gender, city, address };
}

async function addVolunteer({ age, hourlyCharge, city, gender,accountId}) {
  const savedVolunteer = await db.Volunteer.findOne({ where: { accountId } });
  if(savedVolunteer){
    savedVolunteer.city = city;
    savedVolunteer.hourlyCharge = hourlyCharge;
    await savedVolunteer.save();
    return {
      age: savedVolunteer.age,
      city:savedVolunteer.city,
      gender:savedVolunteer.gender,
      hourlyCharge:savedVolunteer.hourlyCharge,

    }
  }
  else
  {
    const volunteer = new db.Volunteer({ age, gender, city, hourlyCharge,accountId});
    await volunteer.save();
  }
  return { age, gender, city, hourlyCharge };
}

async function addBankAccount(accountId){
  
  const account = await db.Account.findOne({ where: {id: accountId} });
  const stripeAccount = await stripe.accounts.create({
    type: 'express',
    email: account.email,
    country: 'AU',
    business_type: 'individual',
    individual: {
      email: account.email,
      first_name: account.firstName,
      last_name: account.lastName,
    },
    capabilities: {
      transfers: {
        requested: true,
      },
      card_payments: {
        requested: false,
      }
    },
    tos_acceptance: {
      service_agreement: 'recipient',
    },
    settings: {
      payouts: {
        schedule: {
          interval: 'manual',
        },
      },
    },
    metadata:{
      accountId,

    },
  })
  try{
  const link = await stripe.accountLinks.create({
    account: stripeAccount.id,
    return_url: `http://localhost:4200/${account.role}/payment?action=bank`,
    refresh_url: `http://localhost:4200/${account.role}/payment?action=bankagain`,
    type: 'account_onboarding',
  });
  const payment = new db.Payment({stripeAccountId:stripeAccount.id,accountId})
  await payment.save();
  console.log(link.url);
  return {link:link.url}
}
catch(err){
  console.log(err);
  stripe.accounts.del(stripeAccount.id)
}
}

async function getElderly(accountId) {
    console.log(accountId);
  const elderly = await db.Elderly.findOne({ where: { accountId } });
  const { age, gender, city, address } = elderly;
  return { age, gender, city, address };
}

async function getVolunteer(accountId) {
  const volunteer = await db.Volunteer.findOne({ where: { accountId } });
  const { age, gender, city, hourlyCharge } = volunteer;
  return { age, gender, city, hourlyCharge };
}

async function findVolunteer(elderlyAccountId, days, hours, budget) {
  const elderly = await db.Elderly.findOne({ where: { accountId:elderlyAccountId } });
  const city = elderly.city;
  console.log(city);
  const expectedHourlyCharge = Math.ceil(budget / (days * hours));
  console.log(expectedHourlyCharge);
  const volunteers = await db.Volunteer.findAll({
    where: { city, hourlyCharge: { [Op.lte]: expectedHourlyCharge } },
    include: [{ model: db.Account }],
  });
  return volunteers;
}

async function getVolunteerBookings(userId) {
  const volunteer = await db.Volunteer.findOne({ where: { accountId:userId } });
  const bookings = await db.Booking.findAll({
    where: { volunteerId: volunteer.id },
    include: [{ model: db.Elderly,include:[{model:db.Account}] }],
  });
  return bookings;
}

async function getElderlyBookings(userId) {
    const elderly = await db.Elderly.findOne({ where: { accountId:userId} });
    const bookings = await db.Booking.findAll({
      where: { elderlyId: elderly.id },
      include: [{ model: db.Volunteer,include:[{model:db.Account}]}],
    });
    return bookings;
  }
  
async function refreshToken({ token, ipAddress }) {
    const refreshToken = await getRefreshToken(token);
    const account = await refreshToken.getAccount();

    // replace old refresh token with a new one and save
    const newRefreshToken = generateRefreshToken(account, ipAddress);
    refreshToken.revoked = Date.now();
    refreshToken.revokedByIp = ipAddress;
    refreshToken.replacedByToken = newRefreshToken.token;
    await refreshToken.save();
    await newRefreshToken.save();

    // generate new jwt
    const jwtToken = generateJwtToken(account);

    // return basic details and tokens
    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: newRefreshToken.token
    };
}

async function bookingRequest(elderlyAccountId, days, hours, budget,volunteerId) {
    const elderly = await db.Elderly.findOne({ where: { accountId:elderlyAccountId },include: [{ model: db.Account }], });
    const volunteer = await db.Volunteer.findOne({ where: { id:volunteerId },include: [{ model: db.Account }], });
    const volunteerPayment = await db.Payment.findOne({where: {accountId:volunteer.accountId}})
    const startDate = new Date()
    startDate.setDate(startDate.getDate()+1)
    const endDate = new Date()
    endDate.setDate(startDate.getDate()+ days)
    const booking = new db.Booking({
        startDate,
        endDate,
        status:'REQUESTED',
        hourlyCharge:volunteer.hourlyCharge,
        hours,
        elderlyId:elderly.id,
        volunteerId:volunteer.id
    })
    await booking.save()
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],mode:'payment',
      customer_email:elderly.account.email,
      success_url:`http://localhost:4200/elderly/find-volunteer?action=bookingdone`,
      cancel_url:`http://localhost:4200/elderly/find-volunteer?action=bookingfailed`,
      metadata:{
        bookingId:booking.id,
      },
      payment_intent_data:{
        transfer_data:{
          destination:volunteerPayment.stripeAccountId
        }
      },
      line_items:[{
        quantity:hours*days,
        price_data:{
          currency:'USD',
          unit_amount:volunteer.hourlyCharge*100,
          product_data:{
            name:`Volunteer Service: ${volunteer.account.firstName} ${volunteer.account.lastName}`
          }
        }

      }]
   })
    console.log("session:",session);
    return {message:'booking request placed',link:session.url}
  }

async function revokeToken({ token, ipAddress }) {
  const refreshToken = await getRefreshToken(token);

  // revoke token and save
  refreshToken.revoked = Date.now();
  refreshToken.revokedByIp = ipAddress;
  await refreshToken.save();
}

async  function updateBankAccount(accountId){
  const stripeAccount = await db.Payment.findOne({ where: {accountId} })
  const stripeAccountInfo = await stripe.accounts.retrieve(stripeAccount.stripeAccountId)
  if (
    stripeAccountInfo.external_accounts &&
    stripeAccountInfo.external_accounts.data.length > 0
  ) {
    let isVerified = false;
    if (
     stripeAccountInfo.requirements?.disabled_reason === null &&
     stripeAccountInfo.payouts_enabled &&
     stripeAccountInfo.charges_enabled &&
     stripeAccountInfo.requirements?.eventually_due?.length === 0
    ) {
      isVerified = true;
    }
    const acc = stripeAccountInfo.external_accounts.data[0]
    stripeAccount.bankName=acc.bank_name
    stripeAccount.lastFour = acc.last4
    stripeAccount.paymentMethodId=acc.id
    stripeAccount.isVerified = isVerified
    await stripeAccount.save();
    
  }
  return stripeAccount;
}

async function register(params, origin) {
  // validate
  if (await db.Account.findOne({ where: { email: params.email } })) {
    // send already registered error in email to prevent account enumeration
    return await sendAlreadyRegisteredEmail(params.email, origin);
  }

  // create account object
  const account = new db.Account(params);

  // first registered account is an admin
  const isFirstAccount = (await db.Account.count()) === 0;
  account.role = isFirstAccount ? Role.Admin : account.role;
  account.verificationToken = randomTokenString();

  // hash password
  account.passwordHash = await hash(params.password);

  // save account
  await account.save();

  // send email
  await sendVerificationEmail(account, origin);
}

async function verifyEmail({ token }) {
  const account = await db.Account.findOne({
    where: { verificationToken: token },
  });

  if (!account) throw "Verification failed";

  account.verified = Date.now();
  account.verificationToken = null;
  await account.save();
}

async function forgotPassword({ email }, origin) {
  const account = await db.Account.findOne({ where: { email } });

  // always return ok response to prevent email enumeration
  if (!account) return;

  // create reset token that expires after 24 hours
  account.resetToken = randomTokenString();
  account.resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await account.save();

  // send email
  await sendPasswordResetEmail(account, origin);
}

async function validateResetToken({ token }) {
  const account = await db.Account.findOne({
    where: {
      resetToken: token,
      resetTokenExpires: { [Op.gt]: Date.now() },
    },
  });

  if (!account) throw "Invalid token";

  return account;
}

async function resetPassword({ token, password }) {
  const account = await validateResetToken({ token });

  // update password and remove reset token
  account.passwordHash = await hash(password);
  account.passwordReset = Date.now();
  account.resetToken = null;
  await account.save();
}

async function getAll() {
  const accounts = await db.Account.findAll();
  return accounts.map((x) => basicDetails(x));
}

async function getById(id) {
  const account = await getAccount(id);
  return basicDetails(account);
}

async function create(params) {
  // validate
  if (await db.Account.findOne({ where: { email: params.email } })) {
    throw 'Email "' + params.email + '" is already registered';
  }

  const account = new db.Account(params);
  account.verified = Date.now();

  // hash password
  account.passwordHash = await hash(params.password);

  // save account
  await account.save();

  return basicDetails(account);
}

async function update(id, params) {
  const account = await getAccount(id);

  // validate (if email was changed)
  if (
    params.email &&
    account.email !== params.email &&
    (await db.Account.findOne({ where: { email: params.email } }))
  ) {
    throw 'Email "' + params.email + '" is already taken';
  }

  // hash password if it was entered
  if (params.password) {
    params.passwordHash = await hash(params.password);
  }

  // copy params to account and save
  Object.assign(account, params);
  account.updated = Date.now();
  await account.save();

  return basicDetails(account);
}

async function _delete(id) {
  const account = await getAccount(id);
  await account.destroy();
}

// helper functions

async function getAccount(id) {
  const account = await db.Account.findByPk(id);
  if (!account) throw "Account not found";
  return account;
}

async function getRefreshToken(token) {
  const refreshToken = await db.RefreshToken.findOne({ where: { token } });
  if (!refreshToken || !refreshToken.isActive) throw "Invalid token";
  return refreshToken;
}

async function hash(password) {
  return await bcrypt.hash(password, 10);
}

function generateJwtToken(account) {
  // create a jwt token containing the account id that expires in 15 minutes
  return jwt.sign({ sub: account.id, id: account.id }, config.secret, {
    expiresIn: "15d",
  });
}

function generateRefreshToken(account, ipAddress) {
  // create a refresh token that expires in 7 days
  return new db.RefreshToken({
    accountId: account.id,
    token: randomTokenString(),
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdByIp: ipAddress,
  });
}

function randomTokenString() {
  return crypto.randomBytes(40).toString("hex");
}

function basicDetails(account) {
  const {
    id,
    title,
    firstName,
    lastName,
    email,
    role,
    created,
    updated,
    isVerified,
  } = account;
  return {
    id,
    title,
    firstName,
    lastName,
    email,
    role,
    created,
    updated,
    isVerified,
  };
}

async function sendVerificationEmail(account, origin) {
  let message;
  if (origin) {
    const verifyUrl = `${origin}/account/verify-email?token=${account.verificationToken}`;
    message = `<p>Please click the below link to verify your email address:</p>
                   <p><a href="${verifyUrl}">${verifyUrl}</a></p>`;
  } else {
    message = `<p>Please use the below token to verify your email address with the <code>/account/verify-email</code> api route:</p>
                   <p><code>${account.verificationToken}</code></p>`;
  }
  console.log("SENDING EMAIL VERIFICATION");
  await sendEmail({
    to: account.email,
    subject: "Sign-up Verification API - Verify Email",
    html: `<h4>Verify Email</h4>
               <p>Thanks for registering!</p>
               ${message}`,
  });
}

async function sendAlreadyRegisteredEmail(email, origin) {
  let message;
  if (origin) {
    message = `<p>If you don't know your password please visit the <a href="${origin}/account/forgot-password">forgot password</a> page.</p>`;
  } else {
    message = `<p>If you don't know your password you can reset it via the <code>/account/forgot-password</code> api route.</p>`;
  }

  await sendEmail({
    to: email,
    subject: "Sign-up Verification API - Email Already Registered",
    html: `<h4>Email Already Registered</h4>
               <p>Your email <strong>${email}</strong> is already registered.</p>
               ${message}`,
  });
}

async function sendPasswordResetEmail(account, origin) {
  let message;
  if (origin) {
    const resetUrl = `${origin}/account/reset-password?token=${account.resetToken}`;
    message = `<p>Please click the below link to reset your password, the link will be valid for 1 day:</p>
                   <p><a href="${resetUrl}">${resetUrl}</a></p>`;
  } else {
    message = `<p>Please use the below token to reset your password with the <code>/account/reset-password</code> api route:</p>
                   <p><code>${account.resetToken}</code></p>`;
  }

  await sendEmail({
    to: account.email,
    subject: "Sign-up Verification API - Reset Password",
    html: `<h4>Reset Password Email</h4>
               ${message}`,
  });
}
