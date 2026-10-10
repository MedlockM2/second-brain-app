# The chat's streaming door (task-464): FastAPI under uvicorn, run by the Lambda
# Web Adapter in response-stream mode, behind the REST API Gateway of
# infrastructure/terraform/modules/platform/chat_stream.tf.
#
# A third image, so a third thing that can drift: it copies the API image's
# discipline to the letter (task-430 complement C1.11, point 4). Same AWS base,
# same Python, and dependencies installed from uv.lock, never from the pyproject
# ranges -- an unpinned resolution is what once took the dev API down (see
# lambda-api.Dockerfile).

FROM public.ecr.aws/lambda/python:3.11-arm64

# The adapter runs as a Lambda extension: it takes the invocations, forwards them
# to uvicorn on AWS_LWA_PORT as plain HTTP, and streams the response back in the
# format API Gateway's STREAM mode requires (JSON metadata, an 8-byte null
# delimiter, then the body). Pinned: a floating tag would change the bytes on the
# wire without a commit.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.1.0 /lambda-adapter /opt/extensions/lambda-adapter

RUN pip install --no-cache-dir uv

WORKDIR ${LAMBDA_TASK_ROOT}

COPY pyproject.toml uv.lock ./

RUN uv export --frozen --no-dev --no-emit-project --format requirements-txt \
      -o /tmp/requirements.txt \
    && uv pip install --system --no-cache-dir -r /tmp/requirements.txt \
    && rm /tmp/requirements.txt

COPY media_summarizer/ ./media_summarizer/

RUN chmod -R a+rX ${LAMBDA_TASK_ROOT}

ENV AWS_LWA_INVOKE_MODE=response_stream \
    AWS_LWA_PORT=8080 \
    AWS_LWA_READINESS_CHECK_PATH=/health

# The web server is the process Lambda starts, not a handler the runtime
# interface client would call: the base image's entrypoint is replaced.
ENTRYPOINT ["python", "-m", "uvicorn", "media_summarizer.api.chat_stream_app:app", "--host", "127.0.0.1", "--port", "8080"]
