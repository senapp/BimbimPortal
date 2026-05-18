export enum AlgorithmMode {
    Astar = 0,
    Dijkstra = 1,
    BFS = 2,
}

export const getAlgorithmName = (mode: AlgorithmMode): string => {
    switch (mode) {
        case AlgorithmMode.BFS: return "Breadth-First Search";
        case AlgorithmMode.Dijkstra: return "Dijkstra";
        default:
        case AlgorithmMode.Astar: return "A*";
    }
}

export enum HeuristicAlgorithmMode {
    Euclidean = 0,
    Manhattan = 1,
    Chebyshev = 2,
    Octile = 3,
}

export enum RenderMode {
    Square = 0,
    Circle = 1,
    Line = 2,
    None = 3,
}


export type CanvasContext = {
    ctx: CanvasRenderingContext2D | null;
    canvas: HTMLCanvasElement | null;
}