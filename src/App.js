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

export default function App() {
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

    const updateCanvas = useCallback((sideA, sideB, sideC, angleARadians, angleBRadians, angleCRadians) => {
        clearCanvas();

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

        const sizeMultipler = CANVAS_TRIANGLE_MAX_WIDTH / bottomSide;

        const normalizedRightSide = rightSide * sizeMultipler;
        const normalizedBottomSide = bottomSide * sizeMultipler;

        // Start at bottom left.
        let x = CANVAS_TRIANGLE_PADDING, y = CANVAS_WIDTH - CANVAS_TRIANGLE_PADDING;
        const leftAnchor = [x, y];

        // Side C across the bottom.
        canvasContext.current.moveTo(x, y);
        x += normalizedBottomSide;
        const rightAnchor = [x, y];
        
        canvasContext.current.lineTo(x, y);

        // Side A up and to the left.
        const inscribedRightTriangleHeight = normalizedRightSide * Math.sin(rightAngle);
        const inscribedRightTriangleSide1 = normalizedRightSide * Math.cos(rightAngle);
        const inscribedRightTriangleSide2 = normalizedBottomSide - inscribedRightTriangleSide1;

        x -= inscribedRightTriangleSide1;
        y -= inscribedRightTriangleHeight;
        const topAnchor = [x, y];

        canvasContext.current.lineTo(x, y);

        // Side B down and to the left.
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
        // Then left.
        const leftAngleDegrees = Math.round(180 / Math.PI * leftAngle * DEGREES_PRECISION_MULTIPLIER) / DEGREES_PRECISION_MULTIPLIER;
        canvasContext.current.fillText(leftAngleDegrees, leftAnchor[0] - canvasContext.current.measureText(leftAngleDegrees).width, leftAnchor[1]);
    }, []);

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
            const numericSides = [sides.sideA, sides.sideB, sides.sideC].map(side => Number(side));
            const sortedNumericSides = [...numericSides].sort((a, b) => a - b);
            if (sortedNumericSides[0] + sortedNumericSides[1] <= sortedNumericSides[2]) {
                newTriangleIdentification = `The triangle is invalid: ${sortedNumericSides[0]} + ${sortedNumericSides[1]} ≤ ${sortedNumericSides[2]}`;
                clearCanvas();
            } else {
                // If we got here, the triangle is valid. Proceed to identify.
                let angleIdentification, sideLengthIdentification;

                const [sideA, sideB, sideC] = numericSides;

                const angleARadians = Math.acos((Math.pow(sideB, 2) + Math.pow(sideC, 2) - Math.pow(sideA, 2)) / (2 * sideB * sideC));
                const angleBRadians = Math.acos((Math.pow(sideC, 2) + Math.pow(sideA, 2) - Math.pow(sideB, 2)) / (2 * sideC * sideA));
                const angleCRadians = Math.acos((Math.pow(sideA, 2) + Math.pow(sideB, 2) - Math.pow(sideC, 2)) / (2 * sideA * sideB));

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

    useEffect(() => {
        if (canvasRef.current) {
            canvasContext.current = canvasRef.current.getContext("2d");
            canvasContext.current.font = "14px Arial";
            canvasContext.current.fillStyle = "blue";
        }
    }, [canvasRef]);

    function clearCanvas() {
        if (canvasContext.current) {
            canvasContext.current.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            canvasContext.current.beginPath();
        }
    }

    function handleSideChange(event) {
        setSides({
            ...sides,
            [event.target.name]: event.target.value
        });
    }

    function handleFieldBlur(event) {
        setTouched({
            ...touched,
            [event.target.name]: true
        });
    }

    return (
        <Grid container direction='column' spacing={2} style={{ padding: '15px' }}>
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
