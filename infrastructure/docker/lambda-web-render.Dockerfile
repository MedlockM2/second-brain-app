# Lambda image of the web page render worker: the shared worker code plus a
# headless Chromium (web_page_render_worker.py). ARM64 like every other image.
#
# Debian, not the AWS Lambda base: Playwright supports Debian 12 and installs
# Chromium's system libraries itself (`--with-deps`), where Amazon Linux would
# need them listed and kept in step by hand. A non-AWS base needs the runtime
# interface client, hence awslambdaric as the entrypoint.
#
# Only the full Chromium is installed (`--no-shell`): the renderer launches it
# with channel="chromium", because the lighter "headless shell" announces itself
# as HeadlessChrome and is refused by CloudFront-fronted sites
# (infrastructure/web_render/chromium_renderer.py).

FROM public.ecr.aws/docker/library/python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    LAMBDA_TASK_ROOT=/var/task \
    UV_HTTP_TIMEOUT=180

RUN pip install --no-cache-dir uv

WORKDIR /var/task

COPY pyproject.toml uv.lock ./

# The locked versions, as in lambda.Dockerfile: the worker extra (the extraction
# stack every worker carries) and the render extra (Playwright). awslambdaric is
# the runtime interface client a non-AWS base image needs; it ships manylinux
# aarch64 wheels, so nothing is compiled.
RUN uv export --frozen --no-dev --extra worker --extra render --no-emit-project \
      --format requirements-txt -o /tmp/requirements.txt \
    && uv pip install --system --no-cache-dir -r /tmp/requirements.txt \
    && uv pip install --system --no-cache-dir --only-binary=:all: awslambdaric==4.2.3 \
    && rm /tmp/requirements.txt

# Chromium and the Debian packages it links against, at the revision the locked
# Playwright expects. libatomic1 first: the Node driver Playwright ships for
# arm64 links against it, and the slim image lacks it, so the installer itself
# could not start ("libatomic.so.1: cannot open shared object file").
RUN apt-get update \
    && apt-get install -y --no-install-recommends libatomic1 \
    && python -m playwright install --with-deps --no-shell chromium \
    && rm -rf /var/lib/apt/lists/* \
    && chmod -R a+rX /ms-playwright

COPY media_summarizer/ ./media_summarizer/

# Lambda runs as a non-root user with a read-only filesystem except /tmp: the
# code must be readable, and Chromium's profile, caches and fontconfig must go
# to /tmp.
RUN chmod -R a+rX /var/task
ENV HOME=/tmp \
    XDG_CACHE_HOME=/tmp/.cache \
    XDG_CONFIG_HOME=/tmp/.config \
    PYTHONPATH=/var/task

ENTRYPOINT ["python", "-m", "awslambdaric"]
CMD ["media_summarizer.workers.lambda_handlers.web_page_render_handler"]
