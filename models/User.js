const mongoose = require('mongoose')
const mongoosePaginate = require('mongoose-paginate-v2')
const validator = require('validator') // https://www.npmjs.com/package/validator
const bcrypt = require('bcrypt')
const ObjectId = mongoose.Schema.Types.ObjectId
/* ------------------------------------------------------- */

modelName = 'User'

const schema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true
    },
    lastName: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      validate: [validator.isEmail, 'Invalid email']
    },
    password: {
      type: String
    },
    roles: {
      type: Array,
      default: []
    }
  },
  { timestamps: true }
)

/* ------------------------------------------------------- */

// On save(), hash the password and tempKey if new or modified.
schema.pre('save', async function (next) {
  // Hash the password if new or modified.
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10)
  }
  // Hash the tempKey if it exists AND is new or modified.
  if (this.tempKey && this.isModified('tempKey')) {
    this.tempKey = await bcrypt.hash(this.tempKey, 10)
  }
  next()
})

schema.methods = {
  checkPassword: async function (password) {
    return await bcrypt.compare(password, this.password || '')
  }
}

schema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`
})

schema.virtual('initials').get(function () {
  return `${this.firstName[0]} ${this.lastName[0]}`
})

schema.virtual('isAdmin').get(function () {
  return Boolean(this.roles.includes('admin'))
})

// Never return hashedPassword in JSON
schema.set('toJSON', {
  getters: true,
  transform: (doc, ret, options) => {
    delete ret.hashedPassword
    return ret
  }
})

/* ------------------------------------------------------- */
schema.set('toObject', { virtuals: true })
schema.plugin(mongoosePaginate)
module.exports = mongoose.model(modelName, schema)
