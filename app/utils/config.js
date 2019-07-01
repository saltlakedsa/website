const Joi = require('joi');
const path = require('path');
// require and configure dotenv, will load vars in .env in PROCESS.ENV
const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });

// define validation for all the env vars
const envVarsSchema = Joi.object({
	SECRET: Joi.string(),
	MONGOURL: Joi.string(),
	STORE_PUBLISH: Joi.string(),
	STORE_SECRET: Joi.string(),
	STORE_PUBLISH_TEST: Joi.string(),
	STORE_SECRET_TEST: Joi.string(),
	SLACK_CLIENT_ID: Joi.string(),
	SLACK_CLIENT_SECRET: Joi.string(),
	SLACK_CALLBACK_DEV: Joi.string(),
	SLACK_CALLBACK: Joi.string(),
	// UPLOAD_IMG: Joi.string(),
	// UPLOAD_FILE: Joi.string(),
	// UPLOAD_IMG_DEV: Joi.string(),
	// UPLOAD_FILE_DEV: Joi.string(),
	// list of admin e-mails separated by commas
	ADMIN: Joi.string()
})
  .unknown()
  .required();

const { error, value: envVars } = Joi.validate(process.env, envVarsSchema);
if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const config = {
  env: envVars.NODE_ENV,
	secret: envVars.SECRET,
	mongourl: envVars.MONGOURL,
	slackClientId: envVars.SLACK_CLIENT_ID,
	slackClientSecret: envVars.SLACK_CLIENT_SECRET,
	slackCallbackDev: envVars.SLACK_CALLBACK_DEV,
	slackCallback: envVars.SLACK_CALLBACK,
	// uploadedImages: envVars.UPLOAD_IMG,
	// uploadedImagesDev: envVars.UPLOAD_IMG_DEV,
	// uploadedFiles: envVars.UPLOAD_FILE,
	// uploadedFilesDev: envVars.UPLOAD_FILE_DEV,
	storePublish: envVars.STORE_PUBLISH,
	storePublishTest: envVars.STORE_PUBLISH_TEST,
	storeSecret: envVars.STORE_SECRET,
	storeSecretTest: envVars.STORE_SECRET_TEST,
	admin: envVars.ADMIN
};

module.exports = config;
