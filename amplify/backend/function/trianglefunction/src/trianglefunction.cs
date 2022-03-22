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

    public class DisplayData
    {
        public double[] LeftAnchorPoint { get; set; }
        public double[] RightAnchorPoint { get; set; }
        public double[] TopAnchorPoint { get; set; }
        public double[] LeftRightAnchorMidpoint { get; set; }
        public double[] RightTopAnchorMidpoint { get; set; }
        public double[] TopLeftAnchorMidpoint { get; set; }
        public double BottomSide { get; set; }
        public double RightSide { get; set; }
        public double LeftSide { get; set; }
        public double LeftAngleDegrees { get; set; }
        public double RightAngleDegrees { get; set; }
        public double TopAngleDegrees { get; set; }
        public double LeftAngleRadians { get; set; }
        public double RightAngleRadians { get; set; }
        public double TopAngleRadians { get; set; }
    }

    public class TriangleFunctionResponse
    {
        public TriangleData Data { get; set; }
        public DisplayData DisplayData { get; set; }
    }

    public class trianglefunction
    {
        const double PI_OVER_2 = Math.PI / 2;

        /// <summary>
        /// Handles the incoming request from the API gateway.
        /// </summary>
        /// <returns>The response object wrapped in an asynchronous Task.</returns>
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
                    DisplayData displayData = CalculateCanvasAnchorPoints(data, input);

                    TriangleFunctionResponse responseBody = new TriangleFunctionResponse();
                    responseBody.Data = data;
                    responseBody.DisplayData = displayData;

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


        /// <summary>
        /// Determines if the triangle is valid. If it is valid, it identifies
        /// the triangle side and angle classifications. It also calculates each angle.
        /// </summary>
        /// <returns>The calculated triangle data.</returns>
        public TriangleData ClassifyTriangle(TriangleFunctionInput input)
        {
            TriangleData data = new TriangleData();
            double[] sortedNumericSides = new double[] { input.SideA, input.SideB, input.SideC };
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
                data.AngleADegrees = ConvertRadiansToDegrees(data.AngleARadians);
                data.AngleBDegrees = ConvertRadiansToDegrees(data.AngleBRadians);
                data.AngleCDegrees = ConvertRadiansToDegrees(data.AngleCRadians);

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
                if (data.AngleARadians < PI_OVER_2 && data.AngleBRadians < PI_OVER_2 && data.AngleCRadians < PI_OVER_2)
                    data.AngleClassification = AngleClassification.Acute;

                // Second angle case, an obtuse triangle. One angle must be greater than 90 degrees.
                else if (data.AngleARadians > PI_OVER_2 || data.AngleBRadians > PI_OVER_2 || data.AngleCRadians > PI_OVER_2)
                    data.AngleClassification = AngleClassification.Obtuse;

                // Third angle case, a right angle. One angle must measure exactly 90 degrees.
                else if (data.AngleARadians == PI_OVER_2 || data.AngleBRadians == PI_OVER_2 || data.AngleCRadians == PI_OVER_2)
                    data.AngleClassification = AngleClassification.Right;
            }

            return data;
        }

        /// <summary>
        /// Calculates the display data for the triangle.
        /// </summary>
        /// <returns>The calculated display data.</returns>
        public DisplayData CalculateCanvasAnchorPoints(TriangleData data, TriangleFunctionInput input)
        {
            DisplayData displayData = new DisplayData();
            // Find the largest side and make that the bottom. 
            if (input.SideA >= input.SideB && input.SideA >= input.SideC)
            {
                displayData.BottomSide = input.SideA;
                displayData.RightSide = input.SideB;
                displayData.LeftSide = input.SideC;
                displayData.RightAngleRadians = data.AngleCRadians;
                displayData.RightAngleDegrees = data.AngleCDegrees;
                displayData.TopAngleRadians = data.AngleARadians;
                displayData.TopAngleDegrees = data.AngleADegrees;
                displayData.LeftAngleRadians = data.AngleBRadians;
                displayData.LeftAngleDegrees = data.AngleBDegrees;
            }
            else if (input.SideB >= input.SideA && input.SideB >= input.SideC)
            {
                displayData.BottomSide = input.SideB;
                displayData.RightSide = input.SideC;
                displayData.LeftSide = input.SideA;
                displayData.RightAngleRadians = data.AngleARadians;
                displayData.RightAngleDegrees = data.AngleADegrees;
                displayData.TopAngleRadians = data.AngleBRadians;
                displayData.TopAngleDegrees = data.AngleBDegrees;
                displayData.LeftAngleRadians = data.AngleCRadians;
                displayData.LeftAngleDegrees = data.AngleCDegrees;
            }
            else
            {
                displayData.BottomSide = input.SideC;
                displayData.RightSide = input.SideA;
                displayData.LeftSide = input.SideB;
                displayData.RightAngleRadians = data.AngleBRadians;
                displayData.RightAngleDegrees = data.AngleBDegrees;
                displayData.TopAngleRadians = data.AngleCRadians;
                displayData.TopAngleDegrees = data.AngleCDegrees;
                displayData.LeftAngleRadians = data.AngleARadians;
                displayData.LeftAngleDegrees = data.AngleADegrees;
            }

            // Normalize the right and bottom side measurements to fit the canvas.
            // We don't need to normalize the left side - we will extrapolate that from the 
            // inscribed right triangle needed to calculate anchor points.
            double sizeMultipler = input.CanvasTriangleMaxWidth / displayData.BottomSide;
            double normalizedRightSide = displayData.RightSide * sizeMultipler;
            double normalizedBottomSide = displayData.BottomSide * sizeMultipler;

            // Start at bottom left with the padding. 
            double x = input.CanvasTrianglePadding, y = input.CanvasWidth - input.CanvasTrianglePadding;
            displayData.LeftAnchorPoint = new double[] { x, y };

            // Draw the bottom side.
            x += normalizedBottomSide;
            displayData.RightAnchorPoint = new double[] { x, y };

            // Calculate the height and width of both inscribed right triangles.
            double inscribedRightTriangleHeight = normalizedRightSide * Math.Sin(displayData.RightAngleRadians);
            double inscribedRightTriangleSide1 = normalizedRightSide * Math.Cos(displayData.RightAngleRadians);
            double inscribedRightTriangleSide2 = normalizedBottomSide - inscribedRightTriangleSide1;

            // Draw the right side.
            x -= inscribedRightTriangleSide1;
            y -= inscribedRightTriangleHeight;
            displayData.TopAnchorPoint = new double[] { x, y };

            // Calculate the midpoints of the anchor points.
            displayData.LeftRightAnchorMidpoint = new double[] { displayData.RightAnchorPoint[0] - (displayData.RightAnchorPoint[0] - displayData.LeftAnchorPoint[0]) / 2, displayData.RightAnchorPoint[1] - (displayData.RightAnchorPoint[1] - displayData.LeftAnchorPoint[1]) / 2 };
            displayData.RightTopAnchorMidpoint = new double[] { displayData.TopAnchorPoint[0] + (displayData.RightAnchorPoint[0] - displayData.TopAnchorPoint[0]) / 2, displayData.TopAnchorPoint[1] + (displayData.RightAnchorPoint[1] - displayData.TopAnchorPoint[1]) / 2 };
            displayData.TopLeftAnchorMidpoint = new double[] { displayData.TopAnchorPoint[0] - (displayData.TopAnchorPoint[0] - displayData.LeftAnchorPoint[0]) / 2, displayData.TopAnchorPoint[1] - (displayData.TopAnchorPoint[1] - displayData.LeftAnchorPoint[1]) / 2 };

            return displayData;
        }

        /// <summary>
        /// Converts radians to degrees.
        /// </summary>
        /// <returns>The resulting degrees.</returns>
        public double ConvertRadiansToDegrees(double radians)
        {
            return 180 / Math.PI * radians;
        }
    }
}
