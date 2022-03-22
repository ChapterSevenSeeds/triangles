import { useEffect, useRef, useState } from "react";
import { Grid, LinearProgress, TextField, Typography } from "@mui/material"
import { API } from "aws-amplify";
import { debounce } from "lodash";
import { Mutex } from "async-mutex";

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

const sideClassification = {
    "0": "equilateral",
    "1": "isosceles",
    "2": "scalene"
};

const angleClassification = {
    "0": "acute",
    "1": "obtuse",
    "2": "right"
};

const apiCallMutex = new Mutex();

export default function CloudBackend() {
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
    const [loading, setLoading] = useState(false);
    const [triangleIdentification, setTriangleIdentification] = useState("");
    const canvasRef = useRef();
    const canvasContext = useRef();

    /**
     * Rounds the input to a precision.
     * @param {Number} input The input value.
     * @param {Number} precision The amount of decimal places to show in the result.
     * @returns {Number} The result.
     */
    function roundToPrecision(input, precision) {
        const precisionPowerOf10 = Math.pow(10, precision);
        return Math.round(input * precisionPowerOf10) / precisionPowerOf10;
    }

    /**
     * Redraws the triangle and accompanying labels.
     * @param {any} displayData The display data returned from the triangle API. 
     */
    function updateCanvas(displayData) {
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
    }

    /**
     * A debounced function ref that calls the triangle API,
     * displays the triangle classification, and draws the triangle.
     */
    const fetchDataAndUpdate = useRef(debounce(async (sideA, sideB, sideC) => {
        setLoading(true);
        const release = await apiCallMutex.acquire(); // Force each call to be performed synchronously. 
        const triangleResult = await API.post("triangleapi", "/calculate", {
            body: {
                SideA: Number(sideA),
                SideB: Number(sideB),
                SideC: Number(sideC),
                CanvasTriangleMaxWidth: CANVAS_TRIANGLE_MAX_WIDTH,
                CanvasWidth: CANVAS_WIDTH
            }
        });
        release();
        setLoading(false);

        if (!triangleResult.Data.Valid) {
            setTriangleIdentification("Triangle is invalid.");
            clearCanvas();
        } else {
            setTriangleIdentification(`The given sides produce a valid ${angleClassification[triangleResult.Data.AngleClassification]}, ${sideClassification[triangleResult.Data.SideClassification]} triangle.`);
            updateCanvas(triangleResult.DisplayData);
        }
    }, 200));

    /**
     * This is triggered when the any of the sides are changed by the user.
     * It will first check each field for input errors.
     * If all three fields are valid, it will call the triangle API to evaluate the triangle.
     * If any of the fields are invalid, it will immediately show the errors.
     */
    function checkForErrors() {
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

        setError({ ...newErrors });

        // If this variable is empty, then the three fields are valid. Proceed with logic.
        if (newTriangleIdentification === "") {
            fetchDataAndUpdate.current.cancel();
            fetchDataAndUpdate.current(sides.sideA, sides.sideB, sides.sideC);
        } else {
            clearCanvas();
            setTriangleIdentification(newTriangleIdentification);
        }
    }

    /**
     * This is triggered if any of the 3 sides are changed. 
     */
    useEffect(() => {
        checkForErrors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sides]);


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
                {loading && <LinearProgress variant='indeterminate' />}
                <canvas style={{ visibility: loading ? 'hidden' : 'visible' }} ref={canvasRef} id="triangle-viewer" width={CANVAS_HEIGHT} height={CANVAS_WIDTH} />
            </Grid>
        </Grid>
    );
}
