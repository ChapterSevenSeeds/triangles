# Triangles
### By Tyson Jones

Validates and classifies a triangle with the given sides. Displays the triangle to the user. Available at http://tysonsstuff.ddns.net

A switch at the top of the page allows the user to select whether or not to have the cloud backend classify the triangle. Delegating the triangle classification to the cloud backend adds considerable overhead in waiting for the request to come back with the needed triangle data. Both a debouncer and an asynchronous mutex were added to aid in keeping the classification and drawing of the triangle in sync with the three inputs. Disabling the cloud backend allows the browser to perform all of the needed calculations (which, needless to say, improves performance considerably). Regardless, a C# backend exists and is hosted by Amazon Web Services. The integration is a simple REST API via the AWS API Gateway. The only route of this REST API forwards all requests to an AWS Lambda function which was written in C#. The AWS Amplify CLI is what I used to create the backend.
