const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        // userId: {
        //     type: Sequelize.INTEGER,
        //     references: {
        //        model: 'accounts', // 'fathers' refers to table name
        //        key: 'id', // 'id' refers to column name in fathers table
        //     }
        //  },
        startDate: { type: DataTypes.DATE, allowNull: false },
        endDate: { type: DataTypes.DATE, allowNull: false },
        hourlyCharge:{type: DataTypes.INTEGER, allowNull: false },
        status: { type: DataTypes.STRING, allowNull: false },
        hours:{type: DataTypes.INTEGER, allowNull: false },
        };

    const options = {
        // disable default timestamp fields (createdAt and updatedAt)
        timestamps: false, 
              
    };

    return sequelize.define('bookings', attributes, options);
}