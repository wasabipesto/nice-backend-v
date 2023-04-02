# nice-backend-v

Choo-choo! Join the coordinated, distributed search for nice numbers.

## Why does this exist?

Square-cube pandigials ("nice" numbers) seem to be distributed pseudo-randomly. It doesn't take very long to check if a number is pandigital in a specific base, but even after we narrow the search range to numbers with the right amount of digits in their square and cube there's a lot of numbers to check.

This server distributes ranges that clients can claim, search, and return. Many clients can now operate in parallel without having to worry about other coordination details. Their contributions are recorded, saved, and aggregated for analysis on the frontend site [nicenumbers.net](https://nicenumbers.net).

## How can I use it?

Right now there are two clients that can interface with this API:

- [nice-rust](https://github.com/wasabipesto/nice-rust): a modern, fast client in rust that implements all API options.
- [nice-client-py](https://github.com/wasabipesto/nice-client-py): an older, slower version in python. No longer supported.

## What does this do?

The main function of this app lies in a set of APIs that boil down to claiming, submitting, and analyzing "fields".

### Fields

Each field is a set of contiguous numbers valid in one base. Bases are assigned seni-randomly unless a specific base is requested with the `base` parameter. Within a base, `detailed` fields start from the bottom of the valid base range and increase while `niceonly` fields start at the top and decrease until they reach the bottom of the valid range or meet the top of the `detailed` fields. This difference is to avoid duplicating work between the two queues.

### Claiming

Clients can make certain requests when claiming fields:

- `username` can be set to record contributions as a specific user. There is currently no authentication since there is no benefit to impersonating other users.
- `max_range` can be set to request a field less than or equal to the specified size. An expired field may be returned that is smaller than the specified size or a new field may be created with that size.
  - The current minimum, maximum, and default values can be found from the endpoint `/settings`. If the requested size is less than the minimum, a 400 error will be returned. If the requested size is greater than the max, the value will be clamped to the max size.
  - This can be helpful to reduce if your processor cannot process the default range size within 24 hours. Alternatively, if your machine is much faster you may increase this value to reduce the number of network calls.
- `base` can be set to request a field in a specific base. This will return a 400 error if there are no available fiels in the specified base.
  - If no base is specified, there is a `claim_chance_random` probability that a random base is given. This value can be found from the `/settings` endpoint.
- `field` can be set to reclaim a specific field that you have claimed before. This could be a field that is or is not expired, but must not already be completed.

A client can claim fields from the `/claim/detailed` and `/claim/niceonly` endpoints. The returned data structure is nearly identical between the two:

#### Returns

```
GET /claim/detailed
{
  "id": 189568,
  "base": 44,
  "search_start": "146528103471696",
  "search_end": "146529103471696",
  "search_range": "1000000000",
  "claimed_time": "2023-04-02T11:55:39.997Z",
  "expired_time": "2023-04-03T11:55:39.997Z",
  "completed_time": null,
  "username": "anonymous",
  "client_version": null,
  "unique_distribution": null
}
```

```
GET /claim/niceonly
{
  "id": 18318,
  "base": 50,
  "search_start": "97655773000000000",
  "search_end": "97655774000000000",
  "search_range": "1000000000",
  "claimed_time": "2023-04-02T13:46:45.063Z",
  "expired_time": "2023-04-03T13:46:45.063Z",
  "completed_time": null,
  "username": "anonymous",
  "client_version": null,
  "nice_list": null
}
```

- `id` is the internal field id that uniquely references this range
- `base` is the base to be evaluated in
- The search range is from `search_start` up to but not including `search_end`. These are given as strings due to javascript's serializing functions.
- Most of the other items are given as reference only.
  - `claimed_time` is the time the field was registered
  - `expired_time` is the time after which the field may be assigned to a new user
  - `username` is the username under which the field was registered
  - `completed_time`, `client_version`, `unique_distribution`, and `nice_list` will be null until the field is completed

### Submitting

Clients are free to implement any algorithm in any language to process the field. Returning a field requires specifying the `id` of the claimed field and should be done before the `expired_time`. Optionally, you can specify your `username` and `client_version`. These are used for statistics and leaderboards only.

#### Detailed

After requesting a `detailed` field, you must return two objects:

- `unique_count`, a map where:
  - the keys are each integer from 1 to `base`
  - the values are the count of numbers that have that number of unique digits in the square-cube concatenation ("sqube")
    - the value should be 0 if no numbers have that number of unique digits - do not omit digits
- `near_misses`, a map where:
  - the keys are all numbers with a niceness > 0.9
    - where "niceness" is the number of unique digits divided by the base
  - the values are the number of unique digits

```
POST /submit/detailed
{
  id: 189676,
  username: "demoux",
  client_version: "2.0.0",
  unique_count: {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
    9: 0,
    10: 0,
    11: 0,
    12: 0,
    13: 1,
    14: 0,
    15: 6,
    16: 18,
    17: 235,
    18: 2051,
    19: 17178,
    20: 116950,
    21: 654193,
    22: 2931114,
    23: 10450185,
    24: 29592720,
    25: 66598591,
    26: 119217692,
    27: 169799785,
    28: 192305450,
    29: 172819683,
    30: 122887812,
    31: 68831721,
    32: 30181613,
    33: 10281204,
    34: 2689672,
    35: 534019,
    36: 78877,
    37: 8574,
    38: 625,
    39: 29,
    40: 2
    41: 0,
    42: 0,
    43: 0,
    44: 0,
    },
  near_misses: {
    146624446910095: 40,
    146624828942572: 40
  }
}
```

#### Nice-Only

After requesting a `niceonly` field, you must return one object:

- `nice_list`, an array of 100% nice numbers

```
POST /submit/niceonly
{
  id: 18316,
  username: "celebrimbor",
  client_version: "2.0.0",
  nice_list: []
}
```

### Analytics

This server also has various endpoints you can use to query from the database. Feel free to use these to run your own analytics or experiments with the data.

- `/dashboard` returns the data used on the frontend found at [nicenumbers.net](https://nicenumbers.net). This data is subject to change at any point if I change the layout of the frontend. If you are using this data programmatically, I suggest using a dedicated endpoint found below.
- `/settings` returns all settings from the database as key-value pairs.
- `/bases` returns an item for each base including the calculated search range, cached statistics, and completion status.
- `/numbers` returns a list of nice and mostly-nice numbers returned from the detailed `near_misses` result.
  - `min_niceness` can be set to only find numbers with a "niceness" over a certain value. If you are only checking for new nice numbers, you should set this to `1`.
  - `min_number` can be set to limit results to the specified value. This can be useful to iterate through the entire list paginated.
  - `limit` can be set to increase/decrease the number of returned values at once. The current default is 10000.
- `/fields` is currently in progress.

### Running

To run this server, you must have `node` or `docker` installed.

#### Node

```
git clone git@github.com:wasabipesto/nice-backend-v.git
cd nice-backend-v
curl -fsSL https://deb.nodesource.com/setup_19.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install
git secret reveal
npm start
```