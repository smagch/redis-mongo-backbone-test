

# TODO - test json validate error
# TODO - test redirect validate error
# TODO - add MongoError and tesr
errorHandler = (err, req, res, next) ->
  if (err instanceof ValidateError) or (err instanceof InternalServerError)
    if req.xhr
      res.json(err) 
    else
      # TODO how to send error message
      res.redirect('back')
  else
    next(err)

class BaseError extends Error
  constructor: (@message) ->
    super
    Error.captureStackTrace this, arguments.callee
    
class InternalServerError extends BaseError
  name: 'InternalServerError'
    
class ValidateError extends BaseError
  name: 'ValidateError'

class UserNotFound extends BaseError
  name: 'UserNotFound'

class NotFound extends BaseError
  name: 'NotFound'
exports = module.exports =
  errorHandler: errorHandler
  InternalServerError: InternalServerError
  ValidateError: ValidateError
  UserNotFound: UserNotFound
  NotFound: NotFound

  