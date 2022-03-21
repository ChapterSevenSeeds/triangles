using System;
using System.Collections.Generic;
using System.Net;
using System.Threading.Tasks;
using System.Text.Json;

using Amazon.Lambda.Core;
using Amazon.Lambda.APIGatewayEvents;

// Assembly attribute to enable the Lambda function's JSON input to be converted into a .NET class.
[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.Json.JsonSerializer))]

namespace trianglefunction
{
    public enum SideClassification
    {
        Equilateral,
        Isosceles,
        Scalene
    }

    public enum AngleClassification
    {
        Acute,
        Obtuse,
        Right
    }
    public class TriangleFunctionInput
    {
        public double SideA { get; set; }
        public double SideB { get; set; }
        public double SideC { get; set; }
        public int CanvasTriangleMaxWidth { get; set; }
        public int CanvasWidth { get; set; }
        public int CanvasTrianglePadding
        {
            get
            {
                return (CanvasWidth - CanvasTriangleMaxWidth) / 2;
            }
        }
    }

    public class TriangleData
    {
        public bool Valid { get; set; }
        public SideClassification SideClassification { get; set; }
        public AngleClassification AngleClassification { get; set; }
        public double AngleARadians { get; set; }
        public double AngleBRadians { get; set; }
        public double AngleCRadians { get; set; }
        public double AngleADegrees { get; set; }
        public double AngleBDegrees { get; set; }
        public double AngleCDegrees { get; set; }
    }
    public class Anchors
    {
        // Signifies how many times you need to circularly rotate the input (so that the largest side is on the bottom).
        public int InputSideRotation { get; set; }
        public double[] LeftAnchorPoint { get; set; }
        public double[] RightAnchorPoint { get; set; }
        public double[] TopAnchorPoint { get; set; }
        public double[] LeftRightAnchorMidpoint { get; set; }
        public double[] RightTopAnchorMidpoint { get; set; }
        public double[] TopLeftAnchorMidpoint { get; set; }
    }
    public class TriangleFunctionResponse
    {
        public TriangleData Data { get; set; }
        public Anchors Anchors { get; set; }
    }
    public class trianglefunction
    {
        const double piOver2 = Math.PI / 2;

        /// <summary>
        /// A Lambda function to respond to HTTP Get methods from API Gateway
        /// </summary>
        /// <param name="request"></param>
        /// <returns>The list of blogs</returns>
        /// <remarks>
        /// If you rename this function, you will need to update the invocation shim
        /// to match if you intend to test the function with 'amplify mock function'
        /// </remarks>
#pragma warning disable CS1998
        public async Task<APIGatewayProxyResponse> LambdaHandler(APIGatewayProxyRequest request, ILambdaContext context)
        {
            var response = new APIGatewayProxyResponse
            {
                Headers = new Dictionary<string, string> {
                    { "Access-Control-Allow-Origin", "*" },
                    { "Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept" }
                }
            };

            string contentType = null;
            request.Headers?.TryGetValue("Content-Type", out contentType);

            switch (request.HttpMethod)
            {
                case "POST":
                    TriangleFunctionInput input = JsonSerializer.Deserialize<TriangleFunctionInput>(request.Body);
                    TriangleData data = ClassifyTriangle(input);
                    Anchors anchors = CalculateCanvasAnchorPoints(data, input);

                    TriangleFunctionResponse responseBody = new TriangleFunctionResponse();
                    responseBody.Data = data;
                    responseBody.Anchors = anchors;

                    response.StatusCode = (int)HttpStatusCode.OK;
                    response.Body = JsonSerializer.Serialize(responseBody, typeof(TriangleFunctionResponse));
                    response.Headers["Content-Type"] = "application/json";
                    break;
                default:
                    context.Logger.LogLine($"Unrecognized verb {request.HttpMethod}\n");
                    response.StatusCode = (int)HttpStatusCode.BadRequest;
                    break;
            }

            return response;
        }

        public TriangleData ClassifyTriangle(TriangleFunctionInput input)
        {
            TriangleData data = new TriangleData();
            double[] sortedNumericSides = new double[] { input.SideA, input.SideA, input.SideC };
            Array.Sort(sortedNumericSides);
            if (sortedNumericSides[0] + sortedNumericSides[1] <= sortedNumericSides[2])
                data.Valid = false;
            else
            {
                // If we got here, the triangle is valid. Proceed to identify.
                data.Valid = true;

                // Use the law of cosines to calculate each angle in the triangle.
                data.AngleARadians = Math.Acos((Math.Pow(input.SideB, 2) + Math.Pow(input.SideC, 2) - Math.Pow(input.SideA, 2)) / (2 * input.SideB * input.SideC));
                data.AngleBRadians = Math.Acos((Math.Pow(input.SideC, 2) + Math.Pow(input.SideA, 2) - Math.Pow(input.SideB, 2)) / (2 * input.SideC * input.SideA));
                data.AngleCRadians = Math.Acos((Math.Pow(input.SideA, 2) + Math.Pow(input.SideB, 2) - Math.Pow(input.SideC, 2)) / (2 * input.SideA * input.SideB));
                data.AngleADegrees = 180 / Math.PI * data.AngleARadians;
                data.AngleBDegrees = 180 / Math.PI * data.AngleBRadians;
                data.AngleCDegrees = 180 / Math.PI * data.AngleCRadians;

                // Begin classification.

                // First side case, equilateral triangle. All sides are equal.
                if (input.SideA == input.SideB && input.SideB == input.SideC)
                    data.SideClassification = SideClassification.Equilateral;

                // Second side case, an isosceles triangle. Two sides are equal.
                else if (input.SideA == input.SideB || input.SideA == input.SideC || input.SideB == input.SideC)
                    data.SideClassification = SideClassification.Isosceles;

                // Third side case, a scalene triangle. No sides are equal. 
                else
                    data.SideClassification = SideClassification.Scalene;

                // First angle case, an acute triangle. All three angles must be less than 90 degrees.
                if (data.AngleARadians < piOver2 && data.AngleBRadians < piOver2 && data.AngleCRadians < piOver2)
                    data.AngleClassification = AngleClassification.Acute;

                // Second angle case, an obtuse triangle. One angle must be greater than 90 degrees.
                else if (data.AngleARadians > piOver2 || data.AngleBRadians > piOver2 || data.AngleCRadians > piOver2)
                    data.AngleClassification = AngleClassification.Obtuse;

                // Third angle case, a right angle. One angle must measure exactly 90 degrees.
                else if (data.AngleARadians == piOver2 || data.AngleBRadians == piOver2 || data.AngleCRadians == piOver2)
                    data.AngleClassification = AngleClassification.Right;
            }

            return data;
        }

        public Anchors CalculateCanvasAnchorPoints(TriangleData data, TriangleFunctionInput input)
        {
            Anchors anchors = new Anchors();
            // Find the largest side and make that the bottom. 
            double bottomSide, rightSide, leftSide, rightAngle, topAngle, leftAngle;
            if (input.SideA >= input.SideB && input.SideA >= input.SideC)
            {
                anchors.InputSideRotation = 0;
                bottomSide = input.SideA;
                rightSide = input.SideB;
                leftSide = input.SideC;
                rightAngle = data.AngleCRadians;
                topAngle = data.AngleARadians;
                leftAngle = data.AngleBRadians;
            }
            else if (input.SideB >= input.SideA && input.SideB >= input.SideC)
            {
                anchors.InputSideRotation = 1;
                bottomSide = input.SideB;
                rightSide = input.SideC;
                leftSide = input.SideA;
                rightAngle = data.AngleARadians;
                topAngle = data.AngleBRadians;
                leftAngle = data.AngleCRadians;
            }
            else
            {
                anchors.InputSideRotation = 2;
                bottomSide = input.SideC;
                rightSide = input.SideA;
                leftSide = input.SideB;
                rightAngle = data.AngleBRadians;
                topAngle = data.AngleCRadians;
                leftAngle = data.AngleARadians;
            }

            // Normalize the right and bottom side measurements to fit the canvas.
            // We don't need to normalize the left side - we will extrapolate that from the 
            // inscribed right triangle needed to calculate anchor points.
            double sizeMultipler = input.CanvasTriangleMaxWidth / bottomSide;
            double normalizedRightSide = rightSide * sizeMultipler;
            double normalizedBottomSide = bottomSide * sizeMultipler;

            // Start at bottom left with the padding. 
            double x = input.CanvasTrianglePadding, y = input.CanvasWidth - input.CanvasTrianglePadding;
            anchors.LeftAnchorPoint = new double[] { x, y };

            // Draw the bottom side.
            x += normalizedBottomSide;
            anchors.RightAnchorPoint = new double[] { x, y };

            // Calculate the height and width of both inscribed right triangles.
            double inscribedRightTriangleHeight = normalizedRightSide * Math.Sin(rightAngle);
            double inscribedRightTriangleSide1 = normalizedRightSide * Math.Cos(rightAngle);
            double inscribedRightTriangleSide2 = normalizedBottomSide - inscribedRightTriangleSide1;

            // Draw the right side.
            x -= inscribedRightTriangleSide1;
            y -= inscribedRightTriangleHeight;
            anchors.TopAnchorPoint = new double[] { x, y };

            // Calculate the midpoints of the anchor points.
            anchors.LeftRightAnchorMidpoint = new double[] { anchors.RightAnchorPoint[0] - (anchors.RightAnchorPoint[0] - anchors.LeftAnchorPoint[0]) / 2, anchors.RightAnchorPoint[1] - (anchors.RightAnchorPoint[1] - anchors.LeftAnchorPoint[1]) / 2 };
            anchors.RightTopAnchorMidpoint = new double[] { anchors.TopAnchorPoint[0] + (anchors.RightAnchorPoint[0] - anchors.TopAnchorPoint[0]) / 2, anchors.TopAnchorPoint[1] + (anchors.RightAnchorPoint[1] - anchors.TopAnchorPoint[1]) / 2 };
            anchors.TopLeftAnchorMidpoint = new double[] { anchors.TopAnchorPoint[0] - (anchors.TopAnchorPoint[0] - anchors.LeftAnchorPoint[0]) / 2, anchors.TopAnchorPoint[1] - (anchors.TopAnchorPoint[1] - anchors.LeftAnchorPoint[1]) / 2 };

            return anchors;
        }
    }
}
