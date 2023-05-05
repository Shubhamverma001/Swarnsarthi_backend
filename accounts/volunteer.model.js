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
        hourlyCharge: { type: DataTypes.INTEGER, allowNull: false },
        city: { type: DataTypes.STRING, allowNull: false },
        age: { type: DataTypes.INTEGER, allowNull: false },
        gender: { type: DataTypes.STRING, allowNull: false },
    };

    const options = {
        // disable default timestamp fields (createdAt and updatedAt)
        timestamps: false, 
              
    };
    

    return sequelize.define('volunteer', attributes, options);
}