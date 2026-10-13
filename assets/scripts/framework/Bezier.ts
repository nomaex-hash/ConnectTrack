// @ts-nocheck
import { _decorator, Component, Node, Vec3, bezierByTime, Tween, bezier, TweenAction, Vec2 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Bezier')
export class Bezier {

    //#region self func
    private static CalculateBezierPoint(t: number, p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3): Vec3 {
        let u = 1 - t;
        let tt = t * t;
        let uu = u * u;
        let uuu = uu * u;
        let ttt = tt * t;

        let p: Vec3 = new Vec3(p0.x * uuu, p0.y * uuu, p0.z * uuu);
        p.add(new Vec3(p1.x * 3 * uu * t, p1.y * 3 * uu * t, p1.z * 3 * uu * t));
        p.add(new Vec3(p2.x * 3 * u * tt, p2.y * 3 * u * tt, p2.z * 3 * u * tt));
        p.add(new Vec3(p3.x * ttt, p3.y * ttt, p3.z * ttt));

        return p;
    }

    private static calculateBezierPoint(t: number, p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3): Vec3 {
        var cX = 3 * (p1.x - p0.x),
            bX = 3 * (p2.x - p1.x) - cX,
            aX = p3.x - p0.x - cX - bX;

        var cY = 3 * (p1.y - p0.y),
            bY = 3 * (p2.y - p1.y) - cY,
            aY = p3.y - p0.y - cY - bY;

        var x = (aX * Math.pow(t, 3)) + (bX * Math.pow(t, 2)) + (cX * t) + p0.x;
        var y = (aY * Math.pow(t, 3)) + (bY * Math.pow(t, 2)) + (cY * t) + p0.y;
        return new Vec3(x, y, 0);
    }

    private static calculateAngleBezier(t: number, p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3): number {
        var Q0x = p0.x + (p1.x - p0.x) * t;
        var Q1x = p1.x + (p2.x - p1.x) * t;
        var Q2x = p2.x + (p3.x - p2.x) * t;
        var R0x = Q0x + (Q1x - Q0x) * t;
        var R1x = Q1x + (Q2x - Q1x) * t;

        var Q0y = p0.y + (p1.y - p0.y) * t;
        var Q1y = p1.y + (p2.y - p1.y) * t;
        var Q2y = p2.y + (p3.y - p2.y) * t;
        var R0y = Q0y + (Q1y - Q0y) * t;
        var R1y = Q1y + (Q2y - Q1y) * t;

        var vecR0R1 = new Vec3(R1x - R0x, R1y - R0y);
        vecR0R1 = vecR0R1.normalize();
        function getAngleBetweenVectors(v1: Vec3, v2: Vec3): number {
            let angleDegV1 = Math.atan2(v1.y, v1.x) * (180 / Math.PI);
            let angleDegV2 = Math.atan2(v2.y, v2.x) * (180 / Math.PI);
            let angleDeg = - angleDegV2 + angleDegV1;
            return angleDeg;
        }

        return getAngleBetweenVectors(vecR0R1, new Vec3(0, 1));
    }
    //#endregion

    public static GetListPointsToTween(numPoint: number, p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3): Vec3[] {
        let result: Vec3[] = [];

        for (let i = 0; i <= numPoint; i++) {
            let t = i / numPoint;
            let pixel1 = Bezier.calculateBezierPoint(t, p0, p1, p2, p3);
            result.push(pixel1);
        }

        return result;
    }

    public static GetListAnglesToTween(numPoint: number, p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3): number[] {
        let result: number[] = [];
        for (let i = 0; i <= numPoint; i++) {
            let t = i / numPoint;
            let angle = Bezier.calculateAngleBezier(t, p0, p1, p2, p3);
            result.push(angle);
        }
        return result;
    }

    public static CalculateBezierPoint2(t, p0, p1, p2) {
        var cX = 2 * (p1.x - p0.x),
            aX = p2.x - p0.x - cX;

        var cY = 2 * (p1.y - p0.y),
            aY = p2.y - p0.y - cY;

        var x = (aX * Math.pow(t, 2)) + (cX * t) + p0.x;
        var y = (aY * Math.pow(t, 2)) + (cY * t) + p0.y;

        return new Vec3(x, y, 0);
    }

    public static GetListPointsToTween2(numPoint: number, startPos: Vec3, endPos: Vec3): Vec3[] {
        let result: Vec3[] = [];
        let midPos = new Vec3(startPos.x, endPos.y);
        // let midPos = startPos.add(endPos).multiplyScalar(1/2);
        // console.log(startPos , midPos , endPos);

        for (let i = 0; i <= numPoint; i++) {
            let pixel1 = Bezier.CalculateBezierPoint2(i / numPoint, startPos, midPos, endPos);
            result.push(pixel1);
        }

        return result;
    }

    public static GetListPointsToTween3(numPoint: number, startPos: Vec3, midPos: Vec3, endPos: Vec3): Vec3[] {
        let result: Vec3[] = [];

        for (let i = 0; i <= numPoint; i++) {
            let pixel1 = Bezier.CalculateBezierPoint2(i / numPoint, startPos, midPos, endPos);
            result.push(pixel1);
        }

        return result;
    }
}