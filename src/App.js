import { useEffect, useRef, useState } from "react";
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
            } else {
                // If we got here, the triangle is valid. Proceed to identify.
                let angleIdentification, sideLengthIdentification;

                const [sideA, sideB, sideC] = numericSides;

                const angleARadians = Math.acos((Math.pow(sideB, 2) + Math.pow(sideC, 2) - Math.pow(sideA, 2)) / (2 * sideB * sideC));
                const angleBRadians = Math.acos((Math.pow(sideC, 2) + Math.pow(sideA, 2) - Math.pow(sideB, 2)) / (2 * sideC * sideA));
                const angleCRadians = Math.acos((Math.pow(sideA, 2) + Math.pow(sideB, 2) - Math.pow(sideC, 2)) / (2 * sideA * sideB));
                const angleADegrees = (180 / Math.PI) * angleARadians;
                const angleBDegrees = (180 / Math.PI) * angleBRadians;
                const angleCDegrees = (180 / Math.PI) * angleCRadians;


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
                if (angleADegrees < 90 && angleBDegrees < 90 && angleCDegrees < 90) {
                    angleIdentification = "acute";
                }

                // Second angle case, an obtuse triangle. One angle must be greater than 90 degrees.
                else if (angleADegrees > 90 || angleBDegrees > 90 || angleCDegrees > 90) {
                    angleIdentification = "obtuse";
                }

                // Third angle case, a right angle. One angle must measure exactly 90 degrees.
                else if (angleADegrees === 90 || angleBDegrees === 90 || angleCDegrees === 90) {
                    angleIdentification = "right";
                }

                newTriangleIdentification = `These sides produce a valid ${angleIdentification}, ${sideLengthIdentification} triangle.`;

                updateCanvas(sideA, sideB, sideC, angleARadians, angleBRadians, angleCRadians);
            }
        }

        setError({ ...newErrors });
        setTriangleIdentification(newTriangleIdentification);
    }, [sides]);

    useEffect(() => {
        if (canvasRef.current) {
            canvasContext.current = canvasRef.current.getContext("2d");
        }
    }, [canvasRef]);

    function updateCanvas(sideA, sideB, sideC, angleARadians, angleBRadians, angleCRadians) {
        canvasContext.current.clearRect(0, 0, 200, 200);
        canvasContext.current.beginPath();

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

        const sizeMultipler = 190 / bottomSide;

        const normalizedRightSide = rightSide * sizeMultipler;
        const normalizedBottomSide = bottomSide * sizeMultipler;

        let x = 10, y = 190;

        // Side C across the bottom.
        canvasContext.current.moveTo(x, y);
        x += normalizedBottomSide;

        canvasContext.current.lineTo(x, y);

        // Side A up and to the left.
        const inscribedRightTriangleHeight = normalizedRightSide * Math.sin(rightAngle);
        const inscribedRightTriangleSide1 = normalizedRightSide * Math.cos(rightAngle);
        const inscribedRightTriangleSide2 = normalizedBottomSide - inscribedRightTriangleSide1;

        x -= inscribedRightTriangleSide1;
        y -= inscribedRightTriangleHeight;

        canvasContext.current.lineTo(x, y);

        // Side B down and to the left.
        x -= inscribedRightTriangleSide2;
        y += inscribedRightTriangleHeight;

        canvasContext.current.lineTo(x, y);

        canvasContext.current.stroke();
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
                <canvas ref={canvasRef} id="triangle-viewer" width="200" height="200" />
            </Grid>
        </Grid>
    );
}
