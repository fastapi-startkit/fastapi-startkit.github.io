from pendulum import now

# Queue

```python
class ClassifyTask(Queue):
    queue: str = 'default'
    timeout: int = 60  # Default timeout in seconds
    max_exceptions: int = 3  # Maximum number of exceptions before task is marked as failed

    tries: int | None = None
    rate_limit: str | None = '20/m'
    backoff: int | list[int] = 5
    
    @property
    def retry_until(self):
        return now().add(minutes=1)
    
    def __init__(self, user_id: int):
        self.user_id = user_id

    async def handle(self):
        pass
```

Pushing to the queue
```python
    ClassifyTask().delay(now().add_mintues(20)).queue('default').onConnection('redis')
```


## Running the Queue Worker
```shell
uv run python queue:work --queue=default,priority --connection=redis
```
