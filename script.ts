const L_ACCELERATION_CONST = 0.5;
const G_ACCELERATION_CONST = 0.5;

function rand(factor: number)
{
    return Math.random() * factor;
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

class Quadratic
{
    coefficients: Array<number>;

    constructor(a: number, b: number, c: number)
    {
        this.coefficients = [a, b, c];
    }

    a() { return this.coefficients[0]; }
    b() { return this.coefficients[1]; }
    c() { return this.coefficients[2]; }

    valueAt(x: number): number
    {
        return this.a() * Math.pow(x, 2) + this.b() * x + this.c(); 
    }

    copy(): Quadratic
    {
        return new Quadratic(this.a(), this.b(), this.c());
    }
}

class Particle
{
    value: Quadratic;
    velocity: Quadratic;
    lBest: Quadratic;
    lBestCost: number;

    constructor(factor: number)
    {
        this.value = new Quadratic(rand(factor), rand(factor), rand(factor));
        this.velocity = new Quadratic(0, 0, 0);
        this.lBest = null;
        this.lBestCost = Number.MAX_VALUE;
    }
    
    update(dataset: Array<Point>): void
    {
        var cost = 0;
        for (let point of dataset) {
            let pred = this.value.valueAt(point.x);
            cost += Math.pow(pred - point.y, 2);
        }

        if (this.lBest === null || cost < this.lBestCost) {
            this.lBest = this.value.copy();
            this.lBestCost = cost;
        }
    }
}

class Swarm
{
    target: Quadratic;
    dataset: Array<Point>;
    particles: Array<Particle>;
    gBest: Quadratic;
    gBestCost: number;

    constructor(factor: number, n_datapoints: number, scale: number, noiseFactor: number, n_particles: number)
    {
        this.target = new Quadratic(rand(factor), rand(factor), rand(factor));
        this.dataset = new Array(n_datapoints);
        for (let i = 0; i < n_datapoints; i++) {
            let x = rand(2 * scale) - scale; // Produces a number in the range (-scale, scale)
            let y = this.target.valueAt(x) + rand(2 * noiseFactor) - noiseFactor;
            this.dataset[i] = new Point(x, y);
        }

        this.particles = new Array(n_particles);
        for (let i = 0; i < n_particles; i++) {
            this.particles[i] = new Particle(factor);
        }

        this.gBest = null;
        this.gBestCost = Number.MAX_VALUE;
    }

    updateSwarm(): void
    {   
        for (let particle of this.particles) {
            particle.update(this.dataset);
            
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
                particle.velocity.coefficients[i] += (
                    L_ACCELERATION_CONST * r1 * diffLBest +
                    G_ACCELERATION_CONST * r2 * diffGBest
                );

                particle.value.coefficients[i] += particle.velocity.coefficients[i];
            }
        }
    }
}
