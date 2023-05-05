const config = require('../config.json');
const mysql = require('mysql2/promise');
const { Sequelize } = require('sequelize');

module.exports = db = {};

initialize();

async function initialize() {
    // create db if it doesn't already exist
    const { host, port, user, password, database } = config.database;
    const connection = await mysql.createConnection({ host, port, user, password });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
    console.log(config.database);

    // connect to db
    const sequelize = new Sequelize(database, user, password, { dialect: 'mysql',host });
    sequelize.authenticate().then(async function () {
        console.log("CONNECTED! ");
        db.Booking=require('../accounts/booking.model')(sequelize);
        db.Account = require('../accounts/account.model')(sequelize);
        db.RefreshToken = require('../accounts/refresh-token.model')(sequelize);
        db.Elderly = require('../accounts/elderly.model')(sequelize);
        db.Volunteer = require('../accounts/volunteer.model')(sequelize);
    // define relationships
    db.Account.hasMany(db.RefreshToken, { onDelete: 'CASCADE' });
    db.RefreshToken.belongsTo(db.Account);
    db.Account.hasOne(db.Elderly,{allowNull:true})
    db.Account.hasOne(db.Volunteer,{allowNull:true})
    db.Volunteer.hasMany(db.Booking,{allowNull:true})
    db.Booking.belongsTo(db.Volunteer)
    db.Elderly.belongsTo(db.Account);
    db.Volunteer.belongsTo(db.Account);
    db.Elderly.hasOne(db.Booking,{allowNull:true})
    db.Booking.belongsTo(db.Elderly)
     await sequelize.sync();
    })
    .catch(function (err) {
        console.log("ERROR",err);

    })
    console.log("Hi code is ruunning");
    // init models and add them to the exported db object
    
    
    // sync all models with database
    
}