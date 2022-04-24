const stepCtr = document.getElementById("step") as HTMLHeadingElement;
const bestText = document.getElementById("best") as HTMLParagraphElement;
const targetText = document.getElementById("target") as HTMLParagraphElement;
const costText = document.getElementById("cost") as HTMLParagraphElement;

const graph = document.getElementById("graph") as HTMLCanvasElement;
const sim = document.getElementById("sim") as HTMLCanvasElement;
const graphCtx = graph.getContext("2d");
const simCtx = sim.getContext("2d");

const GRAPH_WIDTH = graph.width = 900;
const GRAPH_HEIGHT = graph.height = 900;
const WIDTH = sim.width = 900;
const HEIGHT = sim.height = 900;

// Get a number in range [0, factor)
function rand(factor: number)
{
    return Math.random() * factor;
}

// Get a number in range (-factor, factor)
function randSigned(factor: number)
{
    if (Math.random() < 0.5) {
        return -rand(factor);
    }

    return rand(factor);
}

function rgb(r: number, g: number, b: number): string
{
    return "rgb(" + r + ", " + g + ", " + b + ")";
}

// Round to two decimal places
function twoplaces(x: number): number
{
    return Math.round(x * 100) / 100;
}

function arrayMax(array: number[]): number
{
    var max = Number.MIN_VALUE;
    for (let x of array) {
        if (max < x) {
            max = x;
        }
    }

    return max;
}

function arrayMin(array: number[]): number
{
    var min = Number.MAX_VALUE;
    for (let x of array) {
        if (min > x) {
            min = x;
        }
    }

    return min;
}

class Point
{
    x: number;
    y: number;

    constructor(x: number, y: number)
    {
        this.x = x;
        this.y = y;
    }
}

class Polynomial
{
    readonly coefficients: number[];
    readonly n_coefs: number;

    constructor(a: number, b: number, remaining: number[])
    {
        this.coefficients = [a, b, ...remaining];
        this.n_coefs = this.coefficients.length;
    }

    getRemaining()
    {
        return this.coefficients.slice(2);
    }

    static random(n_coefs: number, factor: number): Polynomial
    {
        let a = randSigned(factor);
        let b = randSigned(factor);

        let n_remaining = n_coefs - 2;
        let remaining = new Array(n_remaining);
        for (let i = 0; i < n_remaining; i++) {
            remaining[i] = randSigned(factor);
        }

        return new Polynomial(a, b, remaining);
    }

    static zero(n_coefs: number): Polynomial
    {
        let remaining = new Array(n_coefs - 2);
        for (let i = 0; i < n_coefs - 2; i++) remaining[i] = 0;

        return new Polynomial(0, 0, remaining);
    }

    a() { return this.coefficients[0]; }
    b() { return this.coefficients[1]; }

    valueAt(x: number): number
    {
        let y = 0;
        for (let i = 0; i < this.n_coefs; i++) {
            y += this.coefficients[i] * Math.pow(x, i);
        }

        return y;
    }

    copy(): Polynomial
    {
        return new Polynomial(this.coefficients[0], this.coefficients[1], this.coefficients.slice(2));
    }

    toString(): string
    {
        let out = "y = ";
        for (let i = this.n_coefs - 1; i >= 2; i--) {
            out += twoplaces(this.coefficients[i]) + "x^" + i;
            out += " + ";
        }

        out += twoplaces(this.coefficients[this.n_coefs - 2]) + "x + ";
        out += twoplaces(this.coefficients[this.n_coefs - 1]);
        return out;
    }
}

class Position
{
    point: Point;
    color: string;

    constructor(point: Point, color: string)
    {
        this.point = new Point(point.x, point.y);
        this.color = color;
    }
}

class Particle
{
    static readonly n_coefs = 4;
    readonly factor: number;

    value: Polynomial;
    velocity: Polynomial;
    lBest: Polynomial;
    lBestCost: number;

    constructor(factor: number)
    {
        this.factor = factor;
        this.value = Polynomial.random(Particle.n_coefs, factor);
        this.velocity = Polynomial.zero(Particle.n_coefs);
        this.lBest = null;
        this.lBestCost = Number.MAX_VALUE;
    }

    private scale(value: number): number
    {
        return value / (20 * this.factor) + 1/2;
    }

    getPosition(width: number, height: number): Position
    {
        let color = [150, 150, 150];
        for (let i = 0; i < 3; i++) {
            if (2 + i >= Particle.n_coefs) break;
            color[2 - i] = this.value.coefficients[2 + i] / this.factor * 255;
        }

        let x = this.scale(this.value.a()) * width;
        let y = (1 - this.scale(this.value.b())) * height;
        return new Position(new Point(x, y), rgb(color[0], color[1], color[2]));
    }
    
    updateLBest(dataset: Point[]): void
    {
        var cost = 0;
        for (let point of dataset) {
            let pred = this.value.valueAt(point.x);
            cost += Math.pow(pred - point.y, 2);
        }
        cost = Math.sqrt(cost);
        
        if (this.lBest === null || cost < this.lBestCost) {
            this.lBest = this.value.copy();
            this.lBestCost = cost;
        }
    }
}

class Swarm
{
    static readonly N_STEPS = 1000;

    coefFactor: number
    readonly target: Particle;
    dataset: Point[];
    particles: Particle[];
    gBest = null;
    gBestCost = Number.MAX_VALUE;

    step = 0;

    constructor(factor: number, n_datapoints: number, scale: number, noiseFactor: number, n_particles: number)
    {
        this.coefFactor = factor;
        this.target = new Particle(factor);
        targetText.innerText = "Target: " + this.target.value.toString();

        this.dataset = new Array(n_datapoints);
        for (let i = 0; i < n_datapoints; i++) {
            let x = randSigned(scale);
            let noise = randSigned(noiseFactor);
            let y = this.target.value.valueAt(x) + noise;
            this.dataset[i] = new Point(x, y);
        }

        this.particles = new Array(n_particles);
        for (let i = 0; i < n_particles; i++) {
            this.particles[i] = new Particle(factor);
        }
    }

    private getInertiaCoef(): number
    {
        return this.step/Swarm.N_STEPS * (0.4 - 0.8) + 0.8;
    }

    private getAccelerationCoefLocal(): number
    {
        return this.step/Swarm.N_STEPS * (0.5 - 3.5) + 3.5;
    }

    private getAccelerationCoefGlobal(): number
    {
        return this.step/Swarm.N_STEPS * (3.5 - 0.5) + 0.5;
    }

    private updateSwarm(): Swarm
    {
        for (let particle of this.particles) {
            particle.updateLBest(this.dataset);
            
            if (this.gBest === null || particle.lBestCost < this.gBestCost) {
                this.gBest = particle.lBest.copy();
                this.gBestCost = particle.lBestCost;
            }
        }

        for (let i = 0; i < 3; i++) {
            let r1 = Math.random();
            let r2 = Math.random();
            for (let particle of this.particles) {
                let value = particle.value.coefficients[i];
                let diffLBest = particle.lBest.coefficients[i] - value;
                let diffGBest = this.gBest.coefficients[i] - value;
                particle.velocity.coefficients[i] =
                    this.getInertiaCoef() * particle.velocity.coefficients[i] +
                    this.getAccelerationCoefLocal() * r1 * diffLBest +
                    this.getAccelerationCoefGlobal() * r2 * diffGBest;

                particle.value.coefficients[i] += particle.velocity.coefficients[i];
            }
        }

        return this;
    }

    private renderGraph(ctx: CanvasRenderingContext2D): Swarm
    {
        let { width, height } = ctx.canvas.getBoundingClientRect();

        // Clear
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);

        // Border
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, width, height);

        var xs = this.dataset.map(point => point.x);
        var ys = this.dataset.map(point => point.y);
        var x_lower = arrayMin(xs);
        var x_upper = arrayMax(xs);
        var y_lower = arrayMin(ys);
        var y_upper = arrayMax(ys);

        // Display each datapoint in the dataset and each corresponding gBest prediction
        for (let point of this.dataset) {
            ctx.fillStyle = "red";
            ctx.beginPath();
            ctx.arc(
                (point.x - x_lower) / (x_upper - x_lower) * width,
                (1 - (point.y - y_lower) / (y_upper - y_lower)) * height,
                10,
                0,
                Math.PI * 2,
            );
            ctx.fill();
        }

        for (let x = x_lower; x < x_upper; x += (x_upper - x_lower) / 1000) {
            ctx.fillStyle = "blue";
            ctx.beginPath();
            ctx.arc(
                (x - x_lower) / (x_upper - x_lower) * width,
                (1 - (this.gBest.valueAt(x) - y_lower) / (y_upper - y_lower)) * height,
                4,
                0,
                Math.PI * 2,
            );
            ctx.fill();
        }

        return this;
    }

    private renderSwarm(ctx: CanvasRenderingContext2D): Swarm
    {
        let { width, height } = ctx.canvas.getBoundingClientRect();

        // Clear
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);

        // Border
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, ctx.canvas.width, height);

        // Display each particle
        for (let particle of this.particles) {
            let position = particle.getPosition(width, height);
            ctx.fillStyle = position.color;
            ctx.beginPath();
            ctx.arc(
                position.point.x,
                position.point.y,
                10,
                0,
                Math.PI * 2,
            );
            ctx.fill();

            ctx.strokeStyle = "white";
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Display a point for the target
        let position = this.target.getPosition(width, height);
        ctx.fillStyle = position.color;
        ctx.beginPath();
        ctx.arc(
            position.point.x,
            position.point.y,
            15,
            0,
            Math.PI * 2,
        );
        ctx.fill();

        ctx.strokeStyle = "red";
        ctx.lineWidth = 4;
        ctx.stroke();

        return this;
    }

    // Main program loop
    fullUpdate(graphCtx: CanvasRenderingContext2D, simCtx: CanvasRenderingContext2D): void
    {
        if (this.step >= Swarm.N_STEPS) return;

        this.updateSwarm().renderGraph(graphCtx).renderSwarm(simCtx);
        this.step++;
    }
}

function getInitState(): Swarm
{
    return new Swarm(10, 200, 10, 500, 2000);
}

// Initial program state
var swarm = getInitState();
setInterval(() => {
    swarm.fullUpdate(graphCtx, simCtx);

    stepCtr.innerText = "Step: " + swarm.step + "/" + Swarm.N_STEPS;
    bestText.innerText = "Best: " + swarm.gBest.toString();
    costText.innerText = "Cost: " + twoplaces(swarm.gBestCost);
}, 50);

const reset = document.getElementById("reset") as HTMLButtonElement;
reset.onclick = () => {
    swarm = getInitState();
};
