mongoose = require 'mongoose'
Schema = mongoose.Schema
ObjectId = Schema.ObjectId

UserSchema = new Schema
  name: 
    type: String
  editings: [{
    type: ObjectId
    ref: 'Project'
  }]

LoginSchema = new Schema
  user:
    type: ObjectId
    ref: 'User'
  mail: 
    type: String
    index:
      unique : true
  password:
    type: String


DropboxSchema = new Schema
  user:
    type: ObjectId
    ref: 'User'
  uid:
    type: Number
    index:
      unique: true
  referral_link:
    type: String
  display_name:
    type: String
  country:
    type: String
  quota_info:
    shared:
      type: Number
    quota:
      type: Number
    normal:
      type: Number

ProjectSchema = new Schema
  title:
    type: String
    index:
      unique : true
  description:
    type: String
    required: true
  editors: [{
    user:
      type: ObjectId, ref: 'User'
    url:
      type: String
  }]

exports = module.exports = 
  User: mongoose.model 'User', UserSchema
  Login: mongoose.model 'Login', LoginSchema
  Dropbox: mongoose.model 'Dropbox', DropboxSchema
  Project: mongoose.model 'Project', ProjectSchema


  