# hspec

Proof-of-concept Helm release validation tool.

`hspec` tracks changes to Helm release resources, by comparing a changeset against a known snapshot, and allowing a developer to inspect the change to the Helm release against the final Kubernetes resource. `hspec` keeps the snapshot in a directory inside
the Chart, which is meant to be checked into version control.

It's meant to be used alongside other Helm testing or validation tools, to ensure the best results.

## Usage

Running `hspec` against a Helm Chart:

```shell

$ hspec -c mychart

----------

No changes, you're all set!

```

After performing changes to the Chart (say, changing a port number within a resource, and deleting a ConfigMap):

```shell

$ hspec -c mychart

▓▓ removed 1 resource(s)

- default.v1.ConfigMap.hspec-impraise-release-info

apiVersion: v1
kind: ConfigMap
metadata:
  name: hspec-impraise-release-info
  labels:
    author: impraise
    release: hspec-impraise
    resource: release-info
data:
  release: hspec-impraise
  author: impraise
  url: 'https://github.com/impraise/impraise-web/pull/0'
  project: impraise-web
  prNumber: '000'
  deleteIfPrClosed: 'true'
  lsdVersion: light



▓▓ change @ default.impraise.io/v1.Waypoint.hspec-impraise

{
  spec: {
    endpoints: [
      1: {
        port: 443 => 442
      }
    ]
  }
}



----------

1 changes
1 resources removed
0 resources added

prompt: Do you wish to record these changes with hspec?:
```

Replying `yes` automatically records the changes to the snapshot (or with the `-a` option):

```shell
$ hspec -c mychart -a

# ... changes output ...

$ echo $? # => 0
```

## Configuration

`hspec` can be run against any valid Helm Chart. It can be further configured by creating a
`hspec.yaml` file in the root of the Chart. The options in `hspec.yaml` can be used to configure
how the release preview is created (through `helm template`), exclude resources from tracking by
`name` and `kind`, set the hspec snapshot dir, etc.

```yaml
hspecDir: hspec
valuesFiles:
  - values.yaml
  - values/development/values.yaml
  - values/development/secrets.yaml
excludeKind:
  - Secret
excludeName:
  - "myapp-*"
```

---
![](/impraise.png)
