/// Thrown when Datasources has an exception
abstract class DataSourceException implements Exception {}

/// Thrown when something went wrong with thet local server
class LocalServerException implements DataSourceException {}

/// Thrown when something went wrong with a remote server
class RemoteServerException implements DataSourceException {}
