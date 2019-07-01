const Joi = require('joi');
const path = require('path');
// require and configure dotenv, will load vars in .env in PROCESS.ENV
const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });
const isProduction = new RegExp('production').test(process.env.NODE_ENV);
if (isProduction) {
	process.env.SLACK_CALLBACK = 'https://saltlakedsa.org/auth/slack/callback';
} else {
	process.env.SLACK_CALLBACK = 'http://localhost:3111/auth/slack/callback';
}
// define validation for all the env vars
const envVarsSchema = Joi.object({
	NODE_ENV: Joi.string()
	.allow(['development', 'production', 'test', 'provision'])
	.default('production'),
	SECRET: Joi.string(),
	MONGOURL: Joi.string(),
	STORE_PUBLISH: Joi.string(),
	STORE_SECRET: Joi.string(),
	STORE_PUBLISH_TEST: Joi.string(),
	STORE_SECRET_TEST: Joi.string(),
	SLACK_CLIENT_ID: Joi.string(),
	SLACK_CLIENT_SECRET: Joi.string(),
	SLACK_CALLBACK: Joi.string()
	.allow(['https://saltlakedsa.org/auth/slack/callback', 'http://localhost:3111/auth/slack/callback'])
	.default('https://saltlakedsa.org/auth/slack/callback'),
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
	slackCallback: envVars.SLACK_CALLBACK,
	storePublish: envVars.STORE_PUBLISH,
	storePublishTest: envVars.STORE_PUBLISH_TEST,
	storeSecret: envVars.STORE_SECRET,
	storeSecretTest: envVars.STORE_SECRET_TEST,
	admin: envVars.ADMIN
};

module.exports = config;
