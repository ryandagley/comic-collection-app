# Development Log

## Week 1: Project Setup and Initial Infrastructure

- **Date:** 2024-08-14
- Set up Github repo.
- Initialized the AWS CDK project.
- Set up the basic infrastructure, including S3, Lambda, API Gateway, and DynamoDB.
- Created Docs directory for collecting documents such as this Development Log.
- Deployed a "Hello, World!" to the Dev environment and tested the app by accessing the API Gateway endpoint provided by CDK.
- I'm satisfied with the Dev results thus far so I've deployed to the Prod environment as well.  Tested the app and all is well.
- Set up CI/CD pipeline and stored GitHub credentials in Secrets Manager, obfuscating from public code. 
- Pushing `buildspec.yml` and empty `requirements.txt` to repo.

- **Date:** 2024-08-15
- Bug fixes on Dev/Prod environment stack issue.