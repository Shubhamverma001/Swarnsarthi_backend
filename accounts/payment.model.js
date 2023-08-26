const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        stripeAccountId:{ type: DataTypes.STRING, allowNull: true },
        paymentMethodId: { type: DataTypes.STRING, allowNull: true },
        lastFour: { type: DataTypes.STRING, allowNull: true },
        bankName: { type: DataTypes.STRING, allowNull: true },
        isVerified: { type: DataTypes.BOOLEAN, allowNull: true },
    };

    const options = {
        // disable default timestamp fields (createdAt and updatedAt)
        timestamps: false, 
              
    };

    return sequelize.define('payment', attributes, options);
}