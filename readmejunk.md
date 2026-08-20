# Backend areas beyond the basics

Scratch notes — the layers a production backend has that a single Express project usually doesn't yet.

---

## ⚡ 1. Caching layers (the performance layer)

Before hitting a database, backends use high-speed, in-memory data stores (like Redis or Memcached) to save time and computing power.

- **Data caching** — storing the results of slow database queries (like a product catalog or user session) so subsequent requests take 2 milliseconds instead of 200 milliseconds.
- **Edge caching (CDNs)** — using networks like Cloudflare to cache static assets or entire API responses geographically closer to the user.

---

## 🧱 2. Advanced architectural patterns

As apps grow, writing code inside a single project folder becomes unmanageable.

- **Microservices** — splitting one giant backend application into tiny, specialized mini-apps that talk to each other via HTTP, gRPC, or RabbitMQ.
- **gRPC / Protocol Buffers** — a high-performance alternative to REST APIs that uses binary data instead of text (JSON) for lightning-fast internal server-to-server communication.
- **CQRS (Command Query Responsibility Segregation)** — splitting your application logic so that data writes (Commands) and data reads (Queries) use completely different code pathways, or even different databases, for maximum speed.

---

## 👁️ 3. Observability & monitoring (the "what is happening?" layer)

You cannot fix bugs if you don't know they are happening. Production backends require deep tracking.

- **Structured logging** — writing logs in JSON format (using tools like Winston or Logback) so they can be easily searched.
- **Log aggregation** — sending all application logs to a central server (Elasticsearch/ELK Stack, Grafana Loki) so you don't have to SSH into individual machines to read text files.
- **APM (Application Performance Monitoring)** — tools like Datadog, New Relic, or OpenTelemetry that track exactly which database query or API endpoint is running slowly in real time.

---

## ⚙️ 4. Background workers & cron jobs

Not everything a backend does is triggered by an API request from a user.

- **Cron jobs / schedulers** — tasks that run automatically on a fixed timer (e.g. "every night at 12:00 AM, calculate the daily revenue and clear expired user sessions").
- **Background workers** — independent scripts running in the background that continuously pull heavy processing jobs out of queues (like RabbitMQ) so the web server stays free.

---

## 🚀 5. DevOps, deployment, and infrastructure

Code needs a physical or virtual home to run, scale, and update smoothly.

- **Docker & containerisation** — packaging your backend code, system dependencies, and runtime environment into an identical "container" so it runs exactly the same on your laptop as it does on a cloud server.
- **Orchestration (Kubernetes)** — software that automatically manages thousands of Docker containers, handles auto-scaling when traffic spikes, and replaces crashed servers instantly.
- **CI/CD pipelines** — automated scripts (GitHub Actions, GitLab CI) that run your test suites and deploy your code to production the moment you push to git.

---

## 🔄 6. Advanced database concepts

Knowing basic SQL/NoSQL is just the start; keeping data fast at scale requires infrastructure management.

- **Database indexing** — knowing how to structure table indices to optimize search performance.
- **Replication (primary/replica)** — having one main database handle data updates (writes) while copying data to multiple clone databases that handle the heavy search traffic (reads).
- **Database sharding** — splitting a massive database across multiple physical servers (e.g. storing users A–M on Server 1, and users N–Z on Server 2).
- **Database migrations** — version-controlling your database schema changes so your team can safely alter database structures across different environments without losing production data.

---

## Where to go next

To bridge the gap from where you are now:

- Which of these areas feels like the biggest mystery right now?
- Learn infrastructure tools (Docker/AWS) or software patterns (microservices/caching) first?
