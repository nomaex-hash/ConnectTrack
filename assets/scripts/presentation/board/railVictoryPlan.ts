/** A star launched at path positions 0, 3, 6... carries up to three rails. */
export function railStarAmount(pathLength: number, index: number): number {
    return index >= 0 && index < pathLength && index % 3 === 0
        ? Math.min(3, pathLength - index)
        : 0;
}
