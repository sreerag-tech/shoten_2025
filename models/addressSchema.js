const mongoose = require('mongoose');
const {Schema} = mongoose;

const addressSchema = new Schema({
  userId:{
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  addressType:{
    type: String,
    enum: ["Home", "Work", "Other"],
    default: "Home"
  },
  name:{
    type: String,
    required: true
  },
  phone:{
    type: String,
    required: true
  },
  pincode:{
    type: String,
    required: true
  },
  locality:{
    type: String,
    required: true
  },
  address:{
    type: String,
    required: true
  },
  city:{
    type: String,
    required: true
  },
  state:{
    type: String,
    required: true
  },
  landMark:{
    type: String,
    default: null
  },
  altPhone:{
    type: String,
    default: null
  },
  isDefault:{
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
})




const Address = mongoose.model('Address',addressSchema);

module.exports = Address;