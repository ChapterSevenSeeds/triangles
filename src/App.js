import { useCallback, useEffect, useRef, useState } from "react";
import { Grid, TextField, Typography } from "@mui/material"
import { API } from "aws-amplify";

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

    function roundToPrecision(input, precision) {
        const precisionPowerOf10 = Math.pow(10, precision);
        return Math.trunc(input * precisionPowerOf10) / precisionPowerOf10;
    }

    /**
     * Redraws the triangle and accompanying labels.
     * @param {Number} sideA The length of side A.
     * @param {Number} sideB The length of side B.
     * @param {Number} sideC The length of side C.
     * @param {Number} angleARadians The angle measurement between sides B and C in radians.
     * @param {Number} angleBRadians The angle measurement between sides C and A in radians.
     * @param {Number} angleCRadians The angle measurement between sides B and A in radians.
     */
    const updateCanvas = useCallback((displayData) => {
        clearCanvas();
        
        canvasContext.current.moveTo(...displayData.LeftAnchorPoint);
        canvasContext.current.lineTo(...displayData.RightAnchorPoint);
        canvasContext.current.lineTo(...displayData.TopAnchorPoint);
        canvasContext.current.lineTo(...displayData.LeftAnchorPoint);
        canvasContext.current.stroke();

        // Write side labels.
        // Bottom first. This one is shifted up just a tad to avoid overlap with the bottom line.
        canvasContext.current.fillText(displayData.BottomSide, displayData.LeftRightAnchorMidpoint[0], displayData.LeftRightAnchorMidpoint[1] - 2);
        // Right side.
        canvasContext.current.fillText(displayData.RightSide, ...displayData.RightTopAnchorMidpoint);
        // Left side. We want to offset the X location of this label by how long it is so that it doesn't overlap with the line.
        canvasContext.current.fillText(displayData.LeftSide, displayData.TopLeftAnchorMidpoint[0] - canvasContext.current.measureText(displayData.LeftSide).width, displayData.TopLeftAnchorMidpoint[1]);

        // Write angle lables.
        // Right first.
        canvasContext.current.fillText(roundToPrecision(displayData.RightAngleDegrees, DEGREES_PRECISION), ...displayData.RightAnchorPoint);
        // Then top.
        canvasContext.current.fillText(roundToPrecision(displayData.TopAngleDegrees, DEGREES_PRECISION), ...displayData.TopAnchorPoint);
        // Then left. This one is also shifted left by how long it is so that there is no overlap.
        const leftAngleDegreesString = roundToPrecision(displayData.RightAngleDegrees, DEGREES_PRECISION).toString();
        canvasContext.current.fillText(leftAngleDegreesString, displayData.LeftAnchorPoint[0] - canvasContext.current.measureText(leftAngleDegreesString).width, displayData.LeftAnchorPoint[1]);
    }, []);

    /**
     * This is triggered when the any of the sides are changed by the user.
     * It will first check each field for input errors.
     * If all three fields are valid, it will check if the user specified
     * a valid triangle. If the triangle is valid, it determines the class of the triangle,
     * and then calls a function to draw the triangle and accompanying labels.
     */
    const fetchDataAndUpdate = useCallback(async () => {
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
            const triangleResult = await API.post("triangleapi", "/calculate", {
                body: {
                    SideA: Number(sides.sideA),
                    SideB: Number(sides.sideB),
                    SideC: Number(sides.sideC),
                    CanvasTriangleMaxWidth: CANVAS_TRIANGLE_MAX_WIDTH,
                    CanvasWidth: CANVAS_WIDTH
                }
            });

            if (!triangleResult.Data.Valid) {
                clearCanvas();
            } else {
                updateCanvas(triangleResult.DisplayData);
            }
        } else {
            clearCanvas();
        }

        setError({ ...newErrors });
        setTriangleIdentification(newTriangleIdentification);
    }, [sides, updateCanvas]);
    
    useEffect(() => {
        fetchDataAndUpdate();
    }, [sides, fetchDataAndUpdate]);


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
