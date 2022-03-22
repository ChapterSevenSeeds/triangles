import { useCallback, useEffect, useRef, useState } from "react";
import { Grid, TextField, Typography } from "@mui/material"

const inputs = [
    {
        propertyName: "sideA",
        label: "Side a length"
    },
    {
        propertyName: "sideB",
        label: "Side b length"
    },
    {
        propertyName: "sideC",
        label: "Side c length"
    }
];

Math.PIOver2 = Math.PI / 2;

const DEGREES_PRECISION = 2;
const DEGREES_PRECISION_MULTIPLIER = Math.pow(10, DEGREES_PRECISION);
const CANVAS_TRIANGLE_PADDING = 50; // Allows room for the labels.
const CANVAS_WIDTH = 350;
const CANVAS_HEIGHT = 350;
const CANVAS_TRIANGLE_MAX_WIDTH = CANVAS_WIDTH - CANVAS_TRIANGLE_PADDING * 2;

export default function NoBackend() {
    const [sides, setSides] = useState({
        sideA: '',
        sideB: '',
        sideC: ''
    });
    const [touched, setTouched] = useState({
        sideA: false,
        sideB: false,
        sideC: false
    });
    const [error, setError] = useState({
        sideA: '',
        sideB: '',
        sideC: ''
    });
    const [triangleIdentification, setTriangleIdentification] = useState("");
    const canvasRef = useRef();
    const canvasContext = useRef();

    /**
     * Redraws the triangle and accompanying labels.
     * @param {Number} sideA The length of side A.
     * @param {Number} sideB The length of side B.
     * @param {Number} sideC The length of side C.
     * @param {Number} angleARadians The angle measurement between sides B and C in radians.
     * @param {Number} angleBRadians The angle measurement between sides C and A in radians.
     * @param {Number} angleCRadians The angle measurement between sides B and A in radians.
     */
    const updateCanvas = useCallback((sideA, sideB, sideC, angleARadians, angleBRadians, angleCRadians) => {
        clearCanvas();

        // Find the largest side and make that the bottom. 
        let bottomSide, rightSide, leftSide, rightAngle, topAngle, leftAngle;
        if (sideA >= sideB && sideA >= sideC) {
            bottomSide = sideA;
            rightSide = sideB;
            leftSide = sideC;
            rightAngle = angleCRadians;
            topAngle = angleARadians;
            leftAngle = angleBRadians;
        } else if (sideB >= sideA && sideB >= sideC) {
            bottomSide = sideB;
            rightSide = sideC;
            leftSide = sideA;
            rightAngle = angleARadians;
            topAngle = angleBRadians;
            leftAngle = angleCRadians;
        } else {
            bottomSide = sideC;
            rightSide = sideA;
            leftSide = sideB;
            rightAngle = angleBRadians;
            topAngle = angleCRadians;
            leftAngle = angleARadians;
        }

        // Normalize the right and bottom side measurements to fit the canvas.
        // We don't need to normalize the left side - we will extrapolate that from the 
        // inscribed right triangle needed to calculate anchor points.
        const sizeMultipler = CANVAS_TRIANGLE_MAX_WIDTH / bottomSide;
        const normalizedRightSide = rightSide * sizeMultipler;
        const normalizedBottomSide = bottomSide * sizeMultipler;

        // Start at bottom left with the padding. 
        let x = CANVAS_TRIANGLE_PADDING, y = CANVAS_WIDTH - CANVAS_TRIANGLE_PADDING;
        canvasContext.current.moveTo(x, y);
        const leftAnchor = [x, y];

        // Draw the bottom side.
        x += normalizedBottomSide;
        canvasContext.current.lineTo(x, y);
        const rightAnchor = [x, y];

        // Calculate the height and width of both inscribed right triangles.
        const inscribedRightTriangleHeight = normalizedRightSide * Math.sin(rightAngle);
        const inscribedRightTriangleSide1 = normalizedRightSide * Math.cos(rightAngle);
        const inscribedRightTriangleSide2 = normalizedBottomSide - inscribedRightTriangleSide1;

        // Draw the right side.
        x -= inscribedRightTriangleSide1;
        y -= inscribedRightTriangleHeight;
        canvasContext.current.lineTo(x, y);
        const topAnchor = [x, y];

        // Draw the left side. We are essentially just returning to the left anchor point.
        x -= inscribedRightTriangleSide2;
        y += inscribedRightTriangleHeight;
        canvasContext.current.lineTo(x, y);
        canvasContext.current.stroke();

        // Write side labels.
        // Bottom first. This one is shifted up just a tad to avoid overlap with the bottom line.
        canvasContext.current.fillText(bottomSide, rightAnchor[0] - (rightAnchor[0] - leftAnchor[0]) / 2, rightAnchor[1] - (rightAnchor[1] - leftAnchor[1]) / 2 - 2);
        // Right side.
        canvasContext.current.fillText(rightSide, topAnchor[0] + (rightAnchor[0] - topAnchor[0]) / 2, topAnchor[1] + (rightAnchor[1] - topAnchor[1]) / 2);
        // Left side. We want to offset the X location of this label by how long it is so that it doesn't overlap with the line.
        canvasContext.current.fillText(leftSide, topAnchor[0] - (topAnchor[0] - leftAnchor[0]) / 2 - canvasContext.current.measureText(leftSide).width, topAnchor[1] - (topAnchor[1] - leftAnchor[1]) / 2);

        // Write angle lables.
        // Right first.
        canvasContext.current.fillText(Math.round(180 / Math.PI * rightAngle * DEGREES_PRECISION_MULTIPLIER) / DEGREES_PRECISION_MULTIPLIER, ...rightAnchor);
        // Then top.
        canvasContext.current.fillText(Math.round(180 / Math.PI * topAngle * DEGREES_PRECISION_MULTIPLIER) / DEGREES_PRECISION_MULTIPLIER, ...topAnchor);
        // Then left. This one is also shifted left by how long it is so that there is no overlap.
        const leftAngleDegrees = Math.round(180 / Math.PI * leftAngle * DEGREES_PRECISION_MULTIPLIER) / DEGREES_PRECISION_MULTIPLIER;
        canvasContext.current.fillText(leftAngleDegrees, leftAnchor[0] - canvasContext.current.measureText(leftAngleDegrees).width, leftAnchor[1]);
    }, []);

    /**
     * This is triggered when the any of the sides are changed by the user.
     * It will first check each field for input errors.
     * If all three fields are valid, it will check if the user specified
     * a valid triangle. If the triangle is valid, it determines the class of the triangle,
     * and then calls a function to draw the triangle and accompanying labels.
     */
    useEffect(() => {
        let newTriangleIdentification = "";

        // First, check the inputs for errors.
        const newErrors = {
            sideA: "",
            sideB: "",
            sideC: ""
        };
        for (const input of inputs) {
            if (sides[input.propertyName] === "") {
                newErrors[input.propertyName] = "You must specify a value";
                newTriangleIdentification = "One or more fields is missing a value";
            } else if (sides[input.propertyName] < 1) {
                newErrors[input.propertyName] = "Side must be of length 1 or more";
                newTriangleIdentification = "One or more fields is invalid";
            }
        }

        // If this variable is empty, then the three fields are valid. Proceed with logic.
        if (newTriangleIdentification === "") {
            // First, cast the input values to numbers, sort the resulting numbers from smallest to largest,
            // and see if the first two add up to <= the third. If they do, the triangle is invalid.
            // If not, we have a valid triangle. 
            const numericSides = [sides.sideA, sides.sideB, sides.sideC].map(side => Number(side));
            const sortedNumericSides = [...numericSides].sort((a, b) => a - b);
            if (sortedNumericSides[0] + sortedNumericSides[1] <= sortedNumericSides[2]) {
                newTriangleIdentification = `The triangle is invalid: ${sortedNumericSides[0]} + ${sortedNumericSides[1]} ≤ ${sortedNumericSides[2]}`;
                clearCanvas();
            } else {
                // If we got here, the triangle is valid. Proceed to identify.
                let angleIdentification, sideLengthIdentification;

                const [sideA, sideB, sideC] = numericSides;

                // Use the law of cosines to calculate each angle in the triangle.
                const angleARadians = Math.acos((Math.pow(sideB, 2) + Math.pow(sideC, 2) - Math.pow(sideA, 2)) / (2 * sideB * sideC));
                const angleBRadians = Math.acos((Math.pow(sideC, 2) + Math.pow(sideA, 2) - Math.pow(sideB, 2)) / (2 * sideC * sideA));
                const angleCRadians = Math.acos((Math.pow(sideA, 2) + Math.pow(sideB, 2) - Math.pow(sideC, 2)) / (2 * sideA * sideB));

                // Begin classification.

                // First side case, equilateral triangle. All sides are equal.
                if (sideA === sideB && sideB === sideC) {
                    sideLengthIdentification = "equilateral";
                }

                // Second side case, an isosceles triangle. Two sides are equal.
                else if (sideA === sideB || sideA === sideC || sideB === sideC) {
                    sideLengthIdentification = "isosceles";
                }

                // Third side case, a scalene triangle. No sides are equal. 
                else {
                    sideLengthIdentification = "scalene";
                }

                // First angle case, an acute triangle. All three angles must be less than 90 degrees.
                if (angleARadians < Math.PIOver2 && angleBRadians < Math.PIOver2 && angleCRadians < Math.PIOver2) {
                    angleIdentification = "acute";
                }

                // Second angle case, an obtuse triangle. One angle must be greater than 90 degrees.
                else if (angleARadians > Math.PIOver2 || angleBRadians > Math.PIOver2 || angleCRadians > Math.PIOver2) {
                    angleIdentification = "obtuse";
                }

                // Third angle case, a right angle. One angle must measure exactly 90 degrees.
                else if (angleARadians === Math.PIOver2 || angleBRadians === Math.PIOver2 || angleCRadians === Math.PIOver2) {
                    angleIdentification = "right";
                }

                newTriangleIdentification = `These sides produce a valid ${angleIdentification}, ${sideLengthIdentification} triangle.`;

                updateCanvas(sideA, sideB, sideC, angleARadians, angleBRadians, angleCRadians);
            }
        } else {
            clearCanvas();
        }

        setError({ ...newErrors });
        setTriangleIdentification(newTriangleIdentification);
    }, [sides, updateCanvas]);

    /**
     * Triggered when the ref attached to the canvas changes. Should only be invoked twice.
     * First for the initialization of the canvasRef variable, second for the first render of the component.
     * This first render is when we have access to the ref of the canvas.
     */
    useEffect(() => {
        if (canvasRef.current) {
            canvasContext.current = canvasRef.current.getContext("2d");
            canvasContext.current.font = "14px Arial";
            canvasContext.current.fillStyle = "blue";
        }
    }, [canvasRef]);

    /**
     * Clears the canvas.
     */
    function clearCanvas() {
        if (canvasContext.current) {
            canvasContext.current.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            canvasContext.current.beginPath();
        }
    }

    /**
     * Invoked when the user changes a value in any of the inputs.
     * Updates the React state with the new value.
     * @param {any} event The native event.
     */
    function handleSideChange(event) {
        setSides({
            ...sides,
            [event.target.name]: event.target.value
        });
    }

    /**
     * Invoked when the user blurs an input.
     * Updates the React state with which field was blurred.
     * Used to avoid showing errors before the user has done anything on inputs.
     * @param {any} event 
     */
    function handleFieldBlur(event) {
        setTouched({
            ...touched,
            [event.target.name]: true
        });
    }

    return (
        <Grid container direction='column' spacing={2}>
            {inputs.map(side =>
                <Grid item key={side.propertyName}>
                    <TextField
                        type='number'
                        inputProps={{
                            min: 1
                        }}
                        name={side.propertyName}
                        label={side.label}
                        value={sides[side.propertyName]}
                        onChange={handleSideChange}
                        error={Boolean(error[side.propertyName] && touched[side.propertyName])}
                        helperText={touched[side.propertyName] && error[side.propertyName]}
                        onBlur={handleFieldBlur}
                    />
                </Grid>
            )}
            <Grid item>
                <Typography variant='h6'>{triangleIdentification}</Typography>
            </Grid>
            <Grid item>
                <canvas ref={canvasRef} id="triangle-viewer" width="350" height="350" />
            </Grid>
        </Grid>
    );
}
