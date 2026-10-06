FROM python:3.12-slim
WORKDIR /bridge
# Supply the official IBKR SDK from its downloadable TWS API distribution.
COPY vendor/ /sdk/
RUN test -f /sdk/ibapi/setup.py && pip install --no-cache-dir /sdk/ibapi
COPY bridge.py ./
RUN useradd --system --uid 10001 bridge
USER bridge
ENV IBKR_TWS_BIND=0.0.0.0
CMD ["python", "bridge.py"]
