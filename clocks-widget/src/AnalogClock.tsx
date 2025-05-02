import React from "react";
import { BlockAttributes } from "widget-sdk";
import CSS from "csstype";
import moment from "moment-timezone";

export interface AnalogClockProps extends BlockAttributes {
    timezone: string;
    analogclocksize: number | 125;
    analogclockbackgroundcolor: string;
    analogclockbordercolor: string;
    analogclockshowhournotchonly: boolean;
    analogclocknotchcolor: string;
    analogclocknotchcolorhour: string;
    analogclockhandcolorhour: string;
    analogclockhandcolorminute: string;
    analogclockhandcolorsecond: string;
}

const Pointer = ({ value, type, stylespointer, stylespointerhour, stylespointerminute, stylespointersecond }: { value: number, type: string, stylespointer: any, stylespointerhour: any, stylespointerminute: any, stylespointersecond: any }) => {
    if (!['hour', 'minute', 'second'].includes(type)) throw new Error('Type must be either "hour", "minute", or "second"')
    let pointerTypeClass = null
    if (type === 'hour') pointerTypeClass = stylespointerhour
    if (type === 'minute') pointerTypeClass = stylespointerminute
    if (type === 'second') pointerTypeClass = stylespointersecond

    function getRotateAngle() {
        if (type === 'minute' || type === 'second') {
            return value * 6
        }
        else {
            return value * 30
        }
    }
    return (
        <div
            className={`analogclock-pointer-${type}`}
            style={{ transform: `translate(-50%) rotate(${getRotateAngle()}deg)`, ...stylespointer, ...pointerTypeClass }}
        ></div>
    )
}

export const AnalogClock: React.FC<AnalogClockProps> = ({ timezone, analogclocksize, analogclockbackgroundcolor, analogclockbordercolor, analogclockshowhournotchonly, analogclocknotchcolor, analogclocknotchcolorhour, analogclockhandcolorhour, analogclockhandcolorminute, analogclockhandcolorsecond }: AnalogClockProps): React.ReactElement => {

    const [currentTime, setCurrentTime] = React.useState(moment.tz(new Date(), timezone));

    const TICK_NUMBER = 60;

    React.useEffect(() => {
        const id = setInterval(() => {
            setCurrentTime(moment.tz(new Date(), timezone));
        }, 1000)
        return () => {
            clearInterval(id)
        }
    }, []);

    /* =============================================================================
    = STYLING ======================================================================
    ================================================================================ */

    const stylesAnalogClock: CSS.Properties = {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: analogclocksize + "rem",
        height: analogclocksize + "rem",
        borderRadius: "50%",
        backgroundColor: analogclockbordercolor,
    }

    const stylesAnalogClockInner: CSS.Properties = {
        width: "97%",
        height: "97%",
        borderRadius: "50%",
        position: "relative",
        background: analogclockbackgroundcolor,
    }

    const stylesAnalogClockTick: CSS.Properties = {
        position: "absolute",
        width: "2px",
        borderBottom: !analogclockshowhournotchonly ? `${analogclocksize < 10 ? "5px" : "10px"} solid ` + analogclocknotchcolor : "",
        height: "44%",
        top: "50%",
        left: "50%",
        transformOrigin: "top",
    }

    const stylesAnalogClockTickHour: CSS.Properties = {
        width: "3px",
        borderBottom: `${analogclocksize < 10 ? "10px" : "15px"} solid ` + analogclocknotchcolorhour,
        height: "44%",
    }

    const stylesPointer: CSS.Properties = {
        position: "absolute",
        bottom: "50%",
        left: "50%",
        transformOrigin: "bottom",
    }

    const stylesPointerHour: CSS.Properties = {
        width: "2px",
        border: "1px solid " + analogclockhandcolorhour,
        height: "25%",
    }

    const stylesPointerMinute: CSS.Properties = {
        width: "1px",
        border: "1px solid " + analogclockhandcolorminute,
        height: "38%",
    }

    const stylesPointerSecond: CSS.Properties = {
        width: "0px",
        border: "1px solid " + analogclockhandcolorsecond,
        height: "40%",
    }

    /* =============================================================================
    = Rendering of the Component ===================================================
    ================================================================================ */

    return (
        <div style={stylesAnalogClock} className="analogclock-clock">
            <div style={stylesAnalogClockInner} className="analogclock-inner">
                {new Array(TICK_NUMBER).fill(null).map((_el, idx) => {
                    return (
                        <div key={idx}
                            className={`analogclock-tick-${idx}`}
                            style={{ transform: `translateX(-50%) rotate(${idx * 6}deg)`, ...stylesAnalogClockTick, ...idx % 5 === 0 ? stylesAnalogClockTickHour : '' }}
                        ></div>
                    )
                })}
                <Pointer value={currentTime.format("ss") as unknown as number} type="second" stylespointer={stylesPointer} stylespointerhour={stylesPointerHour} stylespointerminute={stylesPointerMinute} stylespointersecond={stylesPointerSecond} />
                <Pointer value={currentTime.format("mm") as unknown as number} type="minute" stylespointer={stylesPointer} stylespointerhour={stylesPointerHour} stylespointerminute={stylesPointerMinute} stylespointersecond={stylesPointerSecond} />
                <Pointer value={currentTime.format("HH") as unknown as number} type="hour" stylespointer={stylesPointer} stylespointerhour={stylesPointerHour} stylespointerminute={stylesPointerMinute} stylespointersecond={stylesPointerSecond} />
            </div>
        </div>
    );
};

export default AnalogClock;
