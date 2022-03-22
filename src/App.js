import { FormControlLabel, Switch } from "@mui/material";
import { useState } from "react";
import CloudBackend from "./CloudBackend";
import NoBackend from "./NoBackend";

export default function App() {
    const [useCloudBackend, setUseCloudBackend] = useState(true);
    return (
        <div style={{ padding: '15px' }}>
            <FormControlLabel label="Use cloud backend" control={<Switch checked={useCloudBackend} onChange={(e) => setUseCloudBackend(e.target.checked)}/>} />
            {useCloudBackend && <CloudBackend />}
            {!useCloudBackend && <NoBackend />}
        </div>
    );
}